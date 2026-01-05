import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AccessLog, AppRole, isManagerOrAbove } from '@/types/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3, Users, Activity, TrendingUp, Loader2, 
  User, Download, LogIn, FileText, ChevronLeft, Calendar,
  Clock, Globe, Timer, Trash2, Pencil, Save, X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import RoleBadge from '@/components/RoleBadge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  role?: AppRole;
  last_login?: string;
  total_logins: number;
  total_downloads: number;
}

interface UserActivity {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
  resource_name?: string;
  ip_address?: string | null;
}

interface TimeRecord {
  id: string;
  record_date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
}

interface EditingTimeRecord {
  id: string;
  record_date: string;
  entry_time: string;
  lunch_exit_time: string;
  lunch_return_time: string;
  exit_time: string;
}

const Reports: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTimeRecords, setShowTimeRecords] = useState(false);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [loadingTimeRecords, setLoadingTimeRecords] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingTimeRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [stats, setStats] = useState({
    totalLogins: 0,
    uniqueUsers: 0,
    todayLogins: 0,
  });

  useEffect(() => {
    if (isManagerOrAbove(user?.role)) {
      fetchUsers();
      fetchOverallStats();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch access logs for stats
      const { data: logs, error: logsError } = await supabase
        .from('access_logs')
        .select('user_id, action, created_at');

      if (logsError) throw logsError;

      // Map users with their stats
      const usersWithStats = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userLogs = logs?.filter((l) => l.user_id === profile.id) || [];
        const loginLogs = userLogs.filter((l) => l.action === 'login');
        const downloadLogs = userLogs.filter((l) => l.action === 'download');
        const lastLogin = loginLogs.length > 0 
          ? loginLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
          : null;

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          is_active: profile.is_active,
          role: userRole?.role as AppRole | undefined,
          last_login: lastLogin || undefined,
          total_logins: loginLogs.length,
          total_downloads: downloadLogs.length,
        };
      });

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('user_id, action, created_at')
        .eq('action', 'login');

      if (error) throw error;

      const logsData = data || [];
      const today = new Date().toDateString();
      const todayLogins = logsData.filter(
        (log) => new Date(log.created_at).toDateString() === today
      ).length;
      const uniqueUsers = new Set(logsData.map((log) => log.user_id)).size;

      setStats({
        totalLogins: logsData.length,
        uniqueUsers,
        todayLogins,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserActivities = async (userId: string) => {
    setLoadingActivities(true);
    try {
      const { data: logs, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enhance logs with resource names
      const enhancedLogs = await Promise.all(
        (logs || []).map(async (log) => {
          let resourceName = '';
          
          if (log.resource_type === 'file' && log.resource_id) {
            const { data: file } = await supabase
              .from('files')
              .select('name')
              .eq('id', log.resource_id)
              .maybeSingle();
            resourceName = file?.name || 'Arquivo removido';
          } else if (log.resource_type === 'product' && log.resource_id) {
            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', log.resource_id)
              .maybeSingle();
            resourceName = product?.name || 'Produto removido';
          }

          return {
            ...log,
            resource_name: resourceName,
            ip_address: log.ip_address,
          };
        })
      );

      setUserActivities(enhancedLogs);
    } catch (error) {
      console.error('Error fetching user activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleSelectUser = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setShowTimeRecords(false);
    setTimeRecords([]);
    fetchUserActivities(userProfile.id);
  };

  const fetchTimeRecords = async (userId: string) => {
    setLoadingTimeRecords(true);
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setTimeRecords(data || []);
      setShowTimeRecords(true);
    } catch (error) {
      console.error('Error fetching time records:', error);
    } finally {
      setLoadingTimeRecords(false);
    }
  };

  const formatPunchTime = (time: string | null) => {
    if (!time) return '--:--';
    return format(new Date(time), 'HH:mm');
  };

  const formatRecordDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const handleDeleteTimeRecord = async (recordId: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de ponto?')) return;
    
    try {
      const { error } = await supabase
        .from('time_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      
      setTimeRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (error) {
      console.error('Error deleting time record:', error);
    }
  };

  const extractTimeFromIso = (isoString: string | null): string => {
    if (!isoString) return '';
    return format(new Date(isoString), 'HH:mm');
  };

  const handleOpenEditDialog = (record: TimeRecord) => {
    setEditingRecord({
      id: record.id,
      record_date: record.record_date,
      entry_time: extractTimeFromIso(record.entry_time),
      lunch_exit_time: extractTimeFromIso(record.lunch_exit_time),
      lunch_return_time: extractTimeFromIso(record.lunch_return_time),
      exit_time: extractTimeFromIso(record.exit_time),
    });
    setEditDialogOpen(true);
  };

  const buildIsoFromTime = (date: string, time: string): string | null => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const dateObj = new Date(date + 'T00:00:00');
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj.toISOString();
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    setSavingEdit(true);
    try {
      const updateData = {
        entry_time: buildIsoFromTime(editingRecord.record_date, editingRecord.entry_time),
        lunch_exit_time: buildIsoFromTime(editingRecord.record_date, editingRecord.lunch_exit_time),
        lunch_return_time: buildIsoFromTime(editingRecord.record_date, editingRecord.lunch_return_time),
        exit_time: buildIsoFromTime(editingRecord.record_date, editingRecord.exit_time),
      };

      const { error } = await supabase
        .from('time_records')
        .update(updateData)
        .eq('id', editingRecord.id);

      if (error) throw error;

      // Update local state
      setTimeRecords(prev => prev.map(r => 
        r.id === editingRecord.id 
          ? { 
              ...r, 
              entry_time: updateData.entry_time,
              lunch_exit_time: updateData.lunch_exit_time,
              lunch_return_time: updateData.lunch_return_time,
              exit_time: updateData.exit_time,
            } 
          : r
      ));

      setEditDialogOpen(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error updating time record:', error);
    } finally {
      setSavingEdit(false);
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return formatDate(dateString);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <LogIn className="w-4 h-4 text-success" />;
      case 'download':
        return <Download className="w-4 h-4 text-primary" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'login':
        return 'Login';
      case 'download':
        return 'Download';
      case 'view':
        return 'Visualização';
      default:
        return action;
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Wait for user data to be fully loaded before checking permissions
  if (!user || user.role === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isManagerOrAbove(user?.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // User Detail View
  if (selectedUser) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                setSelectedUser(null);
                setUserActivities([]);
                setShowTimeRecords(false);
                setTimeRecords([]);
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-4 flex-1">
              <Avatar className="w-16 h-16">
                <AvatarImage src={selectedUser.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{selectedUser.full_name}</h1>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedUser.role && <RoleBadge role={selectedUser.role} size="sm" />}
                  <Badge variant={selectedUser.is_active ? 'default' : 'secondary'}>
                    {selectedUser.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => fetchTimeRecords(selectedUser.id)}
                variant={showTimeRecords ? "default" : "outline"}
                className="gap-2"
                disabled={loadingTimeRecords}
              >
                {loadingTimeRecords ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Timer className="w-4 h-4" />
                )}
                PONTO
              </Button>
            </div>
          </div>

          {/* User Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Logins</p>
                    <p className="text-3xl font-bold mt-1">{selectedUser.total_logins}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <LogIn className="w-6 h-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Downloads</p>
                    <p className="text-3xl font-bold mt-1">{selectedUser.total_downloads}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Último Login</p>
                    <p className="text-lg font-bold mt-1">
                      {selectedUser.last_login 
                        ? formatRelativeTime(selectedUser.last_login)
                        : 'Nunca'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Records Section */}
          {showTimeRecords && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  Registro de Ponto
                </CardTitle>
                <CardDescription>
                  Últimos 30 dias de registros de ponto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTimeRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : timeRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Timer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum registro de ponto encontrado
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-center">Entrada (8h)</TableHead>
                        <TableHead className="text-center">Saída Almoço (12h)</TableHead>
                        <TableHead className="text-center">Retorno (13h)</TableHead>
                        <TableHead className="text-center">Saída (18h)</TableHead>
                        {user?.role === 'dev' && <TableHead className="text-center">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="capitalize">{formatRecordDate(record.record_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.entry_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.entry_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.lunch_exit_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.lunch_exit_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.lunch_return_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.lunch_return_time)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={record.exit_time ? "default" : "secondary"} className="font-mono">
                              {formatPunchTime(record.exit_time)}
                            </Badge>
                          </TableCell>
                          {user?.role === 'dev' && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenEditDialog(record)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteTimeRecord(record.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Histórico de Atividades
              </CardTitle>
              <CardDescription>
                Últimas 100 atividades do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(activity.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(activity.action)}
                            <span className="font-medium">
                              {getActionLabel(activity.action)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {activity.resource_type || 'Sistema'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {activity.resource_name || '-'}
                        </TableCell>
                        <TableCell>
                          {activity.ip_address ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              <span className="font-mono text-xs">{activity.ip_address}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {userActivities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            Nenhuma atividade registrada para este usuário
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Time Record Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Editar Registro de Ponto
              </DialogTitle>
              <DialogDescription>
                {editingRecord && (
                  <span className="capitalize">
                    {format(new Date(editingRecord.record_date + 'T00:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {editingRecord && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="entry_time" className="text-right">
                    Entrada
                  </Label>
                  <Input
                    id="entry_time"
                    type="time"
                    value={editingRecord.entry_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, entry_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lunch_exit_time" className="text-right">
                    Saída Almoço
                  </Label>
                  <Input
                    id="lunch_exit_time"
                    type="time"
                    value={editingRecord.lunch_exit_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, lunch_exit_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lunch_return_time" className="text-right">
                    Retorno
                  </Label>
                  <Input
                    id="lunch_return_time"
                    type="time"
                    value={editingRecord.lunch_return_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, lunch_return_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="exit_time" className="text-right">
                    Saída
                  </Label>
                  <Input
                    id="exit_time"
                    type="time"
                    value={editingRecord.exit_time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, exit_time: e.target.value })}
                    className="col-span-3 font-mono"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingRecord(null);
                }}
                disabled={savingEdit}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // Users List View
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Métricas e análises do sistema</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Logins</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.totalLogins}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuários Ativos</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.uniqueUsers}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Users className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Logins Hoje</p>
                  <p className="text-3xl font-bold mt-1">{loading ? '-' : stats.todayLogins}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Usuários
            </CardTitle>
            <CardDescription>
              Selecione um usuário para ver o relatório completo de atividades
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-center">Logins</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userProfile) => (
                    <TableRow 
                      key={userProfile.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectUser(userProfile)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={userProfile.avatar_url || undefined} />
                            <AvatarFallback>
                              {userProfile.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{userProfile.full_name}</p>
                            <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {userProfile.role ? (
                          <RoleBadge role={userProfile.role} size="sm" />
                        ) : (
                          <Badge variant="outline">Sem cargo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {userProfile.last_login 
                          ? formatRelativeTime(userProfile.last_login)
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{userProfile.total_logins}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{userProfile.total_downloads}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4 mr-1" />
                          Ver Relatório
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
