import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';

const OnlineUsersCard: React.FC = () => {
  const { onlineCount, loading } = useOnlineUsers();

  return (
    <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer h-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Usuários Online
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold">
                {loading ? '-' : onlineCount}
              </p>
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em tempo real
            </p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <Users className="w-6 h-6 text-success" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnlineUsersCard;
