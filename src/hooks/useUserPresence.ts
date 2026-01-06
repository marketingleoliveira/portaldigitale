import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 10 * 1000; // 10 seconds for more precision
const DURATION_UPDATE_INTERVAL = 1000; // Update duration every second
const INACTIVITY_WARNING = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_LOGOUT = 10 * 60 * 1000; // 10 minutes

export const useUserPresence = () => {
  const { user, signOut } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const durationUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(300); // 5 minutes in seconds

  // Reset activity timer on user interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
      setInactivityCountdown(300);
    }
  }, [showInactivityWarning]);

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user?.id) return;

    try {
      const now = new Date().toISOString();
      
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

  // Update session duration in real-time (only duration, NOT session_end - that's for when session truly ends)
  const updateSessionDuration = useCallback(async () => {
    if (!user?.id || !sessionIdRef.current || !sessionStartRef.current) return;

    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);

      await supabase
        .from('user_activity_sessions')
        .update({
          duration_seconds: durationSeconds,
          // Don't set session_end here - only set it when session truly ends
        })
        .eq('id', sessionIdRef.current);
    } catch (error) {
      console.error('Error updating session duration:', error);
    }
  }, [user?.id]);

  const startSession = useCallback(async () => {
    if (!user?.id) return;

    try {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('user_activity_sessions')
        .insert({
          user_id: user.id,
          session_start: now.toISOString(),
          duration_seconds: 0,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error starting session:', error);
        return;
      }

      sessionIdRef.current = data.id;
      sessionStartRef.current = now;
      lastActivityRef.current = Date.now();
      await updatePresence(true);
    } catch (error) {
      console.error('Error in startSession:', error);
    }
  }, [user?.id, updatePresence]);

  const endSession = useCallback(async () => {
    if (!user?.id || !sessionIdRef.current || !sessionStartRef.current) return;

    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);

      // Set session_end only when session truly ends
      await supabase
        .from('user_activity_sessions')
        .update({
          duration_seconds: durationSeconds,
          session_end: now.toISOString(),
        })
        .eq('id', sessionIdRef.current);

      await updatePresence(false);
      sessionIdRef.current = null;
      sessionStartRef.current = null;
    } catch (error) {
      console.error('Error in endSession:', error);
    }
  }, [user?.id, updatePresence]);

  // Check for inactivity
  const checkInactivity = useCallback(async () => {
    const now = Date.now();
    const inactiveTime = now - lastActivityRef.current;

    if (inactiveTime >= INACTIVITY_LOGOUT) {
      // 10 minutes - logout
      setShowInactivityWarning(false);
      await endSession();
      signOut();
    } else if (inactiveTime >= INACTIVITY_WARNING) {
      // 5 minutes - show warning
      const remainingSeconds = Math.ceil((INACTIVITY_LOGOUT - inactiveTime) / 1000);
      setInactivityCountdown(remainingSeconds);
      setShowInactivityWarning(true);
    }
  }, [endSession, signOut]);

  useEffect(() => {
    if (!user?.id) return;

    // Start session when hook mounts
    startSession();

    // Activity event listeners
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Heartbeat to keep presence alive
    heartbeatRef.current = setInterval(() => {
      updatePresence(true);
    }, HEARTBEAT_INTERVAL);

    // Update duration every second for precise tracking
    durationUpdateRef.current = setInterval(() => {
      updateSessionDuration();
    }, DURATION_UPDATE_INTERVAL);

    // Check inactivity every second
    inactivityCheckRef.current = setInterval(() => {
      checkInactivity();
    }, 1000);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateSessionDuration();
        updatePresence(false);
      } else {
        resetActivity();
        updatePresence(true);
      }
    };

    // Handle before unload
    const handleBeforeUnload = () => {
      if (sessionIdRef.current && sessionStartRef.current) {
        const now = new Date();
        const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);
        
        // Use sendBeacon for reliable unload - update session
        const sessionUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_sessions?id=eq.${sessionIdRef.current}`;
        const sessionData = JSON.stringify({
          session_end: now.toISOString(),
          duration_seconds: durationSeconds,
        });
        
        navigator.sendBeacon(sessionUrl, new Blob([sessionData], { type: 'application/json' }));
      }
      
      // Update presence
      const presenceUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const presenceData = JSON.stringify({
        is_online: false,
        last_seen: new Date().toISOString(),
      });
      
      navigator.sendBeacon(presenceUrl, new Blob([presenceData], { type: 'application/json' }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (durationUpdateRef.current) {
        clearInterval(durationUpdateRef.current);
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
      }
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [user?.id, startSession, endSession, updatePresence, updateSessionDuration, resetActivity, checkInactivity]);

  return { 
    updatePresence, 
    resetActivity,
    showInactivityWarning,
    inactivityCountdown,
    dismissWarning: resetActivity,
  };
};
