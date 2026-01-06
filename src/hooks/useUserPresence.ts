import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const OFFLINE_THRESHOLD = 60 * 1000; // 1 minute without heartbeat = offline

export const useUserPresence = () => {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user?.id) return;

    try {
      const now = new Date().toISOString();
      
      // Upsert presence
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen: now,
          session_started: isOnline ? (sessionIdRef.current ? undefined : now) : null,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (error) {
      console.error('Error in updatePresence:', error);
    }
  }, [user?.id]);

  const startSession = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Create a new session
      const { data, error } = await supabase
        .from('user_activity_sessions')
        .insert({
          user_id: user.id,
          session_start: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error starting session:', error);
        return;
      }

      sessionIdRef.current = data.id;
      await updatePresence(true);
    } catch (error) {
      console.error('Error in startSession:', error);
    }
  }, [user?.id, updatePresence]);

  const endSession = useCallback(async () => {
    if (!user?.id || !sessionIdRef.current) return;

    try {
      const now = new Date();
      
      // Get session start time
      const { data: session } = await supabase
        .from('user_activity_sessions')
        .select('session_start')
        .eq('id', sessionIdRef.current)
        .single();

      if (session) {
        const sessionStart = new Date(session.session_start);
        const durationSeconds = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);

        // Update session with end time and duration
        await supabase
          .from('user_activity_sessions')
          .update({
            session_end: now.toISOString(),
            duration_seconds: durationSeconds,
          })
          .eq('id', sessionIdRef.current);
      }

      await updatePresence(false);
      sessionIdRef.current = null;
    } catch (error) {
      console.error('Error in endSession:', error);
    }
  }, [user?.id, updatePresence]);

  useEffect(() => {
    if (!user?.id) return;

    // Start session when hook mounts
    startSession();

    // Heartbeat to keep presence alive
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, HEARTBEAT_INTERVAL);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    // Handle before unload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable unload
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const data = JSON.stringify({
        is_online: false,
        last_seen: new Date().toISOString(),
      });
      
      navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [user?.id, startSession, endSession, updatePresence]);

  return { updatePresence };
};
