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
import { Notification, AppRole } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bell, Plus, Loader2 } from 'lucide-react';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    visible_to_roles: ['vendedor', 'gerente', 'admin'] as AppRole[],
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
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

    setSaving(true);

    try {
      const { error } = await supabase.from('notifications').insert({
        title: newNotification.title,
        message: newNotification.message,
        visible_to_roles: newNotification.visible_to_roles,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Notificação enviada',
      });

      setDialogOpen(false);
      setNewNotification({
        title: '',
        message: '',
        visible_to_roles: ['vendedor', 'gerente', 'admin'],
      });
      fetchNotifications();
    } catch (error) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-muted-foreground">Comunicações internas da equipe</p>
          </div>
          {user?.role === 'admin' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Notificação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Notificação</DialogTitle>
                  <DialogDescription>
                    Crie uma comunicação para a equipe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card key={notification.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                        <Bell className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(notification.created_at)}
                        </CardDescription>
                      </div>
                    </div>
                    {user?.role === 'admin' && (
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
