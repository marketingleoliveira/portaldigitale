import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get online users who don't have location data
    const { data: onlineUsers, error: presenceError } = await supabase
      .from("user_presence")
      .select("user_id")
      .eq("is_online", true);

    if (presenceError) throw presenceError;

    const onlineUserIds = onlineUsers?.map(u => u.user_id) || [];

    if (onlineUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No online users found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get users who have location data
    const { data: usersWithLocation, error: locationError } = await supabase
      .from("user_locations")
      .select("user_id")
      .in("user_id", onlineUserIds);

    if (locationError) throw locationError;

    const usersWithLocationIds = usersWithLocation?.map(u => u.user_id) || [];
    const usersWithoutLocation = onlineUserIds.filter(id => !usersWithLocationIds.includes(id));

    // Send broadcast message to channel for location update
    const channel = supabase.channel("location-update-request");
    
    await channel.send({
      type: "broadcast",
      event: "request-location-update",
      payload: { user_ids: usersWithoutLocation, timestamp: new Date().toISOString() },
    });

    return new Response(
      JSON.stringify({ 
        message: "Location update request sent",
        onlineUsers: onlineUserIds.length,
        usersWithoutLocation: usersWithoutLocation.length,
        userIds: usersWithoutLocation
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});