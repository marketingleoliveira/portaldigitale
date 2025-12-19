import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, TicketIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationBannerProps {
  notifications: number;
  ticketMessages: number;
  onDismiss: () => void;
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notifications,
  ticketMessages,
  onDismiss,
}) => {
  if (notifications === 0 && ticketMessages === 0) return null;

  const messages: string[] = [];
  
  if (notifications > 0) {
    messages.push(
      notifications === 1
        ? '🔔 Você tem 1 nova notificação'
        : `🔔 Você tem ${notifications} novas notificações`
    );
  }
  
  if (ticketMessages > 0) {
    messages.push(
      ticketMessages === 1
        ? '🎫 Você tem 1 nova resposta de ticket'
        : `🎫 Você tem ${ticketMessages} novas respostas de tickets`
    );
  }

  const scrollText = messages.join('   •   ') + '   •   ' + messages.join('   •   ');

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white relative overflow-hidden">
      <div className="flex items-center h-10">
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap inline-flex items-center">
            <span className="mx-4 font-medium">{scrollText}</span>
            <span className="mx-4 font-medium">{scrollText}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 bg-gradient-to-l from-orange-500 via-orange-500 to-transparent pl-8">
          {notifications > 0 && (
            <Link 
              to="/notificacoes"
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors"
            >
              <Bell className="w-4 h-4" />
              Ver
            </Link>
          )}
          {ticketMessages > 0 && (
            <Link 
              to="/tickets"
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors"
            >
              <TicketIcon className="w-4 h-4" />
              Tickets
            </Link>
          )}
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationBanner;
