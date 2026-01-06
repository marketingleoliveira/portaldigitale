import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, X, Clock, Calendar, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface ActivityData {
  user_id: string;
  total_duration: number;
  session_count: number;
  profile?: UserProfile;
}

interface UserActivityReportProps {
  onClose: () => void;
}

const UserActivityReport: React.FC<UserActivityReportProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const { isUserOnline, onlineCount } = useOnlineUsers();

  useEffect(() => {
    fetchActivityData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { start: start.toISOString(), end: now.toISOString() };
  };

  const fetchActivityData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch activity sessions within the period
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_activity_sessions')
        .select('user_id, duration_seconds')
        .gte('session_start', start)
        .lte('session_start', end);

      if (sessionsError) throw sessionsError;

      // Aggregate by user
      const userActivity = new Map<string, { total: number; count: number }>();
      
      (sessions || []).forEach(session => {
        const existing = userActivity.get(session.user_id) || { total: 0, count: 0 };
        userActivity.set(session.user_id, {
          total: existing.total + (session.duration_seconds || 0),
          count: existing.count + 1,
        });
      });

      // Build activity data with profiles
      const activityData: ActivityData[] = (profiles || []).map(profile => {
        const activity = userActivity.get(profile.id);
        return {
          user_id: profile.id,
          total_duration: activity?.total || 0,
          session_count: activity?.count || 0,
          profile,
        };
      });

      // Sort by total duration descending
      activityData.sort((a, b) => b.total_duration - a.total_duration);

      setActivities(activityData);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0min';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day': return 'Hoje';
      case 'week': return 'Última Semana';
      case 'month': return 'Este Mês';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Relatório de Atividade</h2>
          <Badge variant="outline" className="gap-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            {onlineCount} online
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as 'day' | 'week' | 'month')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="day" className="gap-2">
            <Calendar className="w-4 h-4" />
            Dia
          </TabsTrigger>
          <TabsTrigger value="week" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Semana
          </TabsTrigger>
          <TabsTrigger value="month" className="gap-2">
            <Clock className="w-4 h-4" />
            Mês
          </TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo de atividade - {getPeriodLabel()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Sessões</TableHead>
                      <TableHead className="text-right">Tempo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => {
                      const online = isUserOnline(activity.user_id);
                      return (
                        <TableRow key={activity.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={activity.profile?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {activity.profile?.full_name?.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {online && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {activity.profile?.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {activity.profile?.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={online ? 'default' : 'secondary'} className="text-xs">
                              {online ? 'Online' : 'Offline'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {activity.session_count}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatDuration(activity.total_duration)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {activities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhum dado de atividade encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserActivityReport;
