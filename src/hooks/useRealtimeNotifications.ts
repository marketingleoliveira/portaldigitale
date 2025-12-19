import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NewNotification {
  id: string;
  type: 'notification' | 'user_notification' | 'ticket_message';
  title: string;
  message: string;
  createdAt: string;
  ticketId?: string;
}

interface UnreadCount {
  groupNotifications: number;
  userNotifications: number;
  ticketMessages: number;
  total: number;
}

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<UnreadCount>({
    groupNotifications: 0,
    userNotifications: 0,
    ticketMessages: 0,
    total: 0,
  });
  const [newAlerts, setNewAlerts] = useState<NewNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id || !user?.role) return;

    try {
      // Get all group notifications visible to user's role
      const { data: groupNotifications } = await supabase
        .from('notifications')
        .select('id')
        .contains('visible_to_roles', [user.role]);

      // Get read group notifications
      const { data: readGroupNotifications } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .not('notification_id', 'is', null);

      const readGroupIds = new Set(readGroupNotifications?.map(r => r.notification_id) || []);
      const unreadGroupCount = groupNotifications?.filter(n => !readGroupIds.has(n.id)).length || 0;

      // Get user-specific notifications
      const { data: userNotifications } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('target_user_id', user.id);

      // Get read user notifications
      const { data: readUserNotifications } = await supabase
        .from('notification_reads')
        .select('user_notification_id')
        .eq('user_id', user.id)
        .not('user_notification_id', 'is', null);

      const readUserIds = new Set(readUserNotifications?.map(r => r.user_notification_id) || []);
      const unreadUserCount = userNotifications?.filter(n => !readUserIds.has(n.id)).length || 0;

      // Get unread ticket messages (admin replies for users, user messages for admins)
      const { data: userTickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('user_id', user.id);

      let unreadTicketMessages = 0;
      
      if (user.role === 'admin') {
        // Admin sees messages from users
        const { data: ticketMessages } = await supabase
          .from('ticket_messages')
          .select('id, ticket_id')
          .eq('is_admin_reply', false);
        unreadTicketMessages = ticketMessages?.length || 0;
      } else if (userTickets && userTickets.length > 0) {
        // Users see admin replies on their tickets
        const ticketIds = userTickets.map(t => t.id);
        const { data: ticketMessages } = await supabase
          .from('ticket_messages')
          .select('id')
          .in('ticket_id', ticketIds)
          .eq('is_admin_reply', true);
        unreadTicketMessages = ticketMessages?.length || 0;
      }

      setUnreadCount({
        groupNotifications: unreadGroupCount,
        userNotifications: unreadUserCount,
        ticketMessages: unreadTicketMessages,
        total: unreadGroupCount + unreadUserCount,
      });
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  const addNewAlert = useCallback((notification: NewNotification) => {
    setNewAlerts(prev => {
      // Avoid duplicates
      if (prev.some(a => a.id === notification.id)) return prev;
      return [...prev, notification];
    });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setNewAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    setNewAlerts([]);
  }, []);

  const markAllAsRead = async () => {
    if (!user?.id || !user?.role) return;

    try {
      // Get all unread group notifications
      const { data: groupNotifications } = await supabase
        .from('notifications')
        .select('id')
        .contains('visible_to_roles', [user.role]);

      const { data: readGroupNotifications } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .not('notification_id', 'is', null);

      const readGroupIds = new Set(readGroupNotifications?.map(r => r.notification_id) || []);
      const unreadGroupNotifications = groupNotifications?.filter(n => !readGroupIds.has(n.id)) || [];

      // Get all unread user notifications
      const { data: userNotifications } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('target_user_id', user.id);

      const { data: readUserNotifications } = await supabase
        .from('notification_reads')
        .select('user_notification_id')
        .eq('user_id', user.id)
        .not('user_notification_id', 'is', null);

      const readUserIds = new Set(readUserNotifications?.map(r => r.user_notification_id) || []);
      const unreadUserNotifications = userNotifications?.filter(n => !readUserIds.has(n.id)) || [];

      // Insert read records for group notifications
      if (unreadGroupNotifications.length > 0) {
        const groupReads = unreadGroupNotifications.map(n => ({
          user_id: user.id,
          notification_id: n.id,
        }));
        await supabase.from('notification_reads').insert(groupReads);
      }

      // Insert read records for user notifications
      if (unreadUserNotifications.length > 0) {
        const userReads = unreadUserNotifications.map(n => ({
          user_id: user.id,
          user_notification_id: n.id,
        }));
        await supabase.from('notification_reads').insert(userReads);
      }

      setUnreadCount(prev => ({ 
        ...prev, 
        groupNotifications: 0, 
        userNotifications: 0,
        total: 0 
      }));
      dismissAllAlerts();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Setup realtime subscriptions
  useEffect(() => {
    if (!user?.id || !user?.role) return;

    // Subscribe to new group notifications
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.visible_to_roles?.includes(user.role)) {
            addNewAlert({
              id: newNotif.id,
              type: 'notification',
              title: newNotif.title,
              message: newNotif.message,
              createdAt: newNotif.created_at,
            });
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    // Subscribe to user-specific notifications
    const userNotificationsChannel = supabase
      .channel('user-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.target_user_id === user.id) {
            addNewAlert({
              id: newNotif.id,
              type: 'user_notification',
              title: newNotif.title,
              message: newNotif.message,
              createdAt: newNotif.created_at,
            });
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    // Subscribe to ticket messages
    const ticketMessagesChannel = supabase
      .channel('ticket-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // If admin and message is from user, show alert
          if (user.role === 'admin' && !newMessage.is_admin_reply) {
            const { data: ticket } = await supabase
              .from('tickets')
              .select('title')
              .eq('id', newMessage.ticket_id)
              .single();
              
            addNewAlert({
              id: newMessage.id,
              type: 'ticket_message',
              title: 'Nova mensagem em ticket',
              message: ticket?.title || 'Novo chamado recebeu uma mensagem',
              createdAt: newMessage.created_at,
              ticketId: newMessage.ticket_id,
            });
            fetchUnreadCount();
          }
          
          // If user and message is from admin (and it's their ticket)
          if (user.role !== 'admin' && newMessage.is_admin_reply) {
            const { data: ticket } = await supabase
              .from('tickets')
              .select('title, user_id')
              .eq('id', newMessage.ticket_id)
              .single();
              
            if (ticket?.user_id === user.id) {
              addNewAlert({
                id: newMessage.id,
                type: 'ticket_message',
                title: 'Resposta do suporte',
                message: ticket?.title || 'Seu chamado recebeu uma resposta',
                createdAt: newMessage.created_at,
                ticketId: newMessage.ticket_id,
              });
              fetchUnreadCount();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(userNotificationsChannel);
      supabase.removeChannel(ticketMessagesChannel);
    };
  }, [user?.id, user?.role, addNewAlert, fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    newAlerts,
    loading,
    markAllAsRead,
    dismissAlert,
    dismissAllAlerts,
    refetch: fetchUnreadCount,
  };
};
