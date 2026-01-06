import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  session_started: string | null;
}

const OFFLINE_THRESHOLD = 60 * 1000; // 1 minute

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const threshold = new Date(Date.now() - OFFLINE_THRESHOLD).toISOString();
      
      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen, session_started')
        .eq('is_online', true)
        .gte('last_seen', threshold);

      if (error) throw error;

      const users = data || [];
      setOnlineUsers(users);
      setOnlineCount(users.length);
    } catch (error) {
      console.error('Error fetching online users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const isUserOnline = useCallback((userId: string): boolean => {
    const user = onlineUsers.find(u => u.user_id === userId);
    if (!user) return false;
    
    const lastSeen = new Date(user.last_seen).getTime();
    const now = Date.now();
    return user.is_online && (now - lastSeen) < OFFLINE_THRESHOLD;
  }, [onlineUsers]);

  useEffect(() => {
    fetchOnlineUsers();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('user-presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineUsers, 30 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOnlineUsers]);

  return { onlineUsers, onlineCount, loading, isUserOnline, refetch: fetchOnlineUsers };
};
