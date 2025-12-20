import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Notification, AppRole, isManagerOrAbove } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { useToast } from '@/hooks/use-toast';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Plus, Loader2, Users, User } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface UserNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  target_user_id: string;
}

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { markAllAsRead } = useUnreadNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notificationType, setNotificationType] = useState<'group' | 'individual'>('group');

  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    visible_to_roles: ['vendedor', 'gerente', 'admin'] as AppRole[],
    target_user_id: '',
  });

  const canCreateNotifications = isManagerOrAbove(user?.role);

  useEffect(() => {
    fetchNotifications();
    if (canCreateNotifications) {
      fetchUsers();
    }
  }, [canCreateNotifications]);

  // Mark all notifications as read when visiting this page
  useEffect(() => {
    const timer = setTimeout(() => {
      markAllAsRead();
    }, 1000); // Small delay to ensure notifications are loaded first

    return () => clearTimeout(timer);
  }, [markAllAsRead]);

  const fetchNotifications = async () => {
    try {
      // Fetch group notifications
      const { data: groupData, error: groupError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupError) throw groupError;
      setNotifications(groupData || []);

      // Fetch individual notifications for current user
      const { data: userData, error: userError } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('target_user_id', user?.id)
        .order('created_at', { ascending: false });

      if (userError) throw userError;
      setUserNotifications(userData || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateNotification = async () => {
    if (!newNotification.title.trim() || !newNotification.message.trim()) {
      toast({
        title: 'Erro',
        description: 'Título e mensagem são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (notificationType === 'individual' && !newNotification.target_user_id) {
      toast({
        title: 'Erro',
        description: 'Selecione um usuário',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (notificationType === 'group') {
        const { error } = await supabase.from('notifications').insert({
          title: newNotification.title,
          message: newNotification.message,
          visible_to_roles: newNotification.visible_to_roles,
          created_by: user?.id,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_notifications').insert({
          title: newNotification.title,
          message: newNotification.message,
          target_user_id: newNotification.target_user_id,
          created_by: user?.id,
        });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Notificação enviada',
      });

      setDialogOpen(false);
      setNewNotification({
        title: '',
        message: '',
        visible_to_roles: ['vendedor', 'gerente', 'admin'],
        target_user_id: '',
      });
      setNotificationType('group');
      fetchNotifications();
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar notificação',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const allNotifications = [
    ...notifications.map(n => ({ ...n, type: 'group' as const })),
    ...userNotifications.map(n => ({ ...n, type: 'individual' as const, visible_to_roles: [] })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-muted-foreground">Comunicações internas da equipe</p>
          </div>
          {canCreateNotifications && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Notificação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enviar Notificação</DialogTitle>
                  <DialogDescription>
                    Crie uma comunicação para a equipe ou usuário específico
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Notification Type Tabs */}
                  <Tabs value={notificationType} onValueChange={(v) => setNotificationType(v as 'group' | 'individual')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="group" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Grupo
                      </TabsTrigger>
                      <TabsTrigger value="individual" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Individual
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="group" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Visível para</Label>
                        <div className="flex flex-wrap gap-4 pt-2">
                          {(['vendedor', 'gerente', 'admin'] as AppRole[]).map((role) => (
                            <div key={role} className="flex items-center space-x-2">
                              <Checkbox
                                id={`notify-${role}`}
                                checked={newNotification.visible_to_roles.includes(role)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewNotification({
                                      ...newNotification,
                                      visible_to_roles: [...newNotification.visible_to_roles, role],
                                    });
                                  } else {
                                    setNewNotification({
                                      ...newNotification,
                                      visible_to_roles: newNotification.visible_to_roles.filter(
                                        (r) => r !== role
                                      ),
                                    });
                                  }
                                }}
                              />
                              <Label htmlFor={`notify-${role}`} className="cursor-pointer">
                                <RoleBadge role={role} size="sm" />
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="individual" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Selecione o usuário</Label>
                        <Select
                          value={newNotification.target_user_id}
                          onValueChange={(value) =>
                            setNewNotification({ ...newNotification, target_user_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.full_name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={newNotification.title}
                      onChange={(e) =>
                        setNewNotification({ ...newNotification, title: e.target.value })
                      }
                      placeholder="Título da notificação"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem *</Label>
                    <Textarea
                      id="message"
                      value={newNotification.message}
                      onChange={(e) =>
                        setNewNotification({ ...newNotification, message: e.target.value })
                      }
                      placeholder="Conteúdo da mensagem"
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNotification} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {allNotifications.map((notification) => (
              <Card key={notification.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${notification.type === 'individual' ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                        {notification.type === 'individual' ? (
                          <User className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Bell className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(notification.created_at)}
                          {notification.type === 'individual' && (
                            <span className="ml-2 text-blue-500">(Pessoal)</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    {canCreateNotifications && notification.type === 'group' && (
                      <div className="flex gap-1 flex-wrap justify-end">
                        {notification.visible_to_roles.map((role) => (
                          <RoleBadge key={role} role={role as AppRole} size="sm" showIcon={false} />
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {notification.message}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notifications;