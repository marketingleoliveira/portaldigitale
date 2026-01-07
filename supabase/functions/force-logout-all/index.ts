import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin/dev
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin/dev role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (!roleData || !['admin', 'dev'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin or Dev role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Force logout initiated by user: ${requestingUser.id}`);

    // Get all online users
    const { data: onlineUsers, error: presenceError } = await supabaseAdmin
      .from('user_presence')
      .select('user_id')
      .eq('is_online', true);

    if (presenceError) {
      console.error('Error fetching online users:', presenceError);
      throw presenceError;
    }

    console.log(`Found ${onlineUsers?.length || 0} online users`);

    let loggedOutCount = 0;
    const errors: string[] = [];

    // Force sign out each user
    for (const presence of onlineUsers || []) {
      // Skip the requesting user
      if (presence.user_id === requestingUser.id) {
        console.log(`Skipping requesting user: ${presence.user_id}`);
        continue;
      }

      try {
        // Sign out the user using admin API
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(presence.user_id);
        
        if (signOutError) {
          console.error(`Error signing out user ${presence.user_id}:`, signOutError);
          errors.push(`${presence.user_id}: ${signOutError.message}`);
        } else {
          loggedOutCount++;
          console.log(`Successfully signed out user: ${presence.user_id}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Exception signing out user ${presence.user_id}:`, err);
        errors.push(`${presence.user_id}: ${errorMessage}`);
      }
    }

    // Update all user_presence to offline (except requesting user)
    const { error: updateError } = await supabaseAdmin
      .from('user_presence')
      .update({ 
        is_online: false, 
        last_seen: new Date().toISOString() 
      })
      .eq('is_online', true)
      .neq('user_id', requestingUser.id);

    if (updateError) {
      console.error('Error updating presence:', updateError);
    }

    // End all active sessions (except requesting user)
    const { error: sessionsError } = await supabaseAdmin
      .from('user_activity_sessions')
      .update({ 
        session_end: new Date().toISOString() 
      })
      .is('session_end', null)
      .neq('user_id', requestingUser.id);

    if (sessionsError) {
      console.error('Error ending sessions:', sessionsError);
    }

    console.log(`Force logout complete. Logged out ${loggedOutCount} users.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        logged_out_count: loggedOutCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Force logout error:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
