import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UnreadNotificationsAlert: React.FC = () => {
  const navigate = useNavigate();
  const { unreadCount, loading } = useUnreadNotifications();

  if (loading || unreadCount.total === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-foreground/20 rounded-full">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">
              {unreadCount.total === 1 
                ? 'Você tem 1 notificação pendente' 
                : `Você tem ${unreadCount.total} notificações pendentes`}
            </h4>
            <p className="text-sm opacity-90 mt-1">
              Clique para visualizar suas notificações
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/notificacoes')}
            >
              Ver Notificações
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnreadNotificationsAlert;