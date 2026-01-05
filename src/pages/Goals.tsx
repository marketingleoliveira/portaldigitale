import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { hasFullAccess, AppRole } from '@/types/auth';
import {
  Target,
  Plus,
  TrendingUp,
  Calendar,
  Trophy,
  Loader2,
  Edit,
  Trash2,
  Users,
  ChevronUp,
  ChevronDown,
  Minus,
  Medal,
  Crown,
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  unit: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  visible_to_roles: AppRole[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

interface GoalProgress {
  id: string;
  goal_id: string;
  user_id: string;
  current_value: number;
  period_start: string;
  period_end: string;
  notes: string | null;
  updated_at: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  region: string | null;
}

interface SellerRanking {
  userId: string;
  userName: string;
  region: string | null;
  totalProgress: number;
  totalTargets: number;
  percentage: number;
  goalsAchieved: number;
}

const periodLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const periodColors: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-green-500/20 text-green-400 border-green-500/30',
  yearly: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const allRoles: AppRole[] = ['dev', 'admin', 'gerente', 'vendedor'];

const Goals: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role ? hasFullAccess(user.role) : false;
  const isDev = user?.role === 'dev';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedGoalForProgress, setSelectedGoalForProgress] = useState<Goal | null>(null);
  const [selectedUserForProgress, setSelectedUserForProgress] = useState<string>('');
  const [progressValue, setProgressValue] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_value: '',
    unit: 'unidades',
    period_type: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    visible_to_roles: ['vendedor', 'gerente', 'admin', 'dev'] as AppRole[],
  });

  const fetchData = async () => {
    try {
      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;
      setGoals((goalsData || []) as Goal[]);

      // Fetch progress for current period
      const { data: progressData, error: progressError } = await supabase
        .from('goal_progress')
        .select('*');

      if (progressError) throw progressError;
      setProgress(progressData || []);

      // Fetch users - always fetch for ranking
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, region')
        .eq('is_active', true);

      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
      console.error('Error fetching goals:', error);
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  // Realtime subscription for progress updates
  useEffect(() => {
    const channel = supabase
      .channel('goal_progress_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goal_progress' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getPeriodDates = (periodType: string) => {
    const now = new Date();
    switch (periodType) {
      case 'daily':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'weekly':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'monthly':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'yearly':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const getProgressForGoal = (goalId: string, userId?: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;

    const { start } = getPeriodDates(goal.period_type);
    const periodStart = format(start, 'yyyy-MM-dd');

    const relevantProgress = progress.filter(
      p => p.goal_id === goalId && 
           p.period_start === periodStart &&
           (userId ? p.user_id === userId : p.user_id === user?.id)
    );

    return relevantProgress.reduce((sum, p) => sum + p.current_value, 0);
  };

  const getTeamProgressForGoal = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return { total: 0, users: [] as { userId: string; value: number; profile?: UserProfile }[] };

    const { start } = getPeriodDates(goal.period_type);
    const periodStart = format(start, 'yyyy-MM-dd');

    const relevantProgress = progress.filter(
      p => p.goal_id === goalId && p.period_start === periodStart
    );

    const userProgress = relevantProgress.map(p => ({
      userId: p.user_id,
      value: p.current_value,
      profile: users.find(u => u.id === p.user_id),
    }));

    return {
      total: relevantProgress.reduce((sum, p) => sum + p.current_value, 0),
      users: userProgress.sort((a, b) => b.value - a.value),
    };
  };

  const calculatePercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      target_value: '',
      unit: 'unidades',
      period_type: 'monthly',
      visible_to_roles: ['vendedor', 'gerente', 'admin', 'dev'],
    });
    setEditingGoal(null);
  };

  const handleOpenDialog = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        title: goal.title,
        description: goal.description || '',
        target_value: goal.target_value.toString(),
        unit: goal.unit,
        period_type: goal.period_type,
        visible_to_roles: goal.visible_to_roles,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSaveGoal = async () => {
    if (!formData.title || !formData.target_value) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const goalData = {
        title: formData.title,
        description: formData.description || null,
        target_value: parseFloat(formData.target_value),
        unit: formData.unit,
        period_type: formData.period_type,
        visible_to_roles: formData.visible_to_roles,
        created_by: user?.id,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', editingGoal.id);
        if (error) throw error;
        toast.success('Meta atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('goals').insert(goalData);
        if (error) throw error;
        toast.success('Meta criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving goal:', error);
      toast.error('Erro ao salvar meta');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;

    try {
      const { error } = await supabase
        .from('goals')
        .update({ is_active: false })
        .eq('id', goalId);

      if (error) throw error;
      toast.success('Meta excluída com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting goal:', error);
      toast.error('Erro ao excluir meta');
    }
  };

  const handleOpenProgressDialog = (goal: Goal, userId?: string) => {
    setSelectedGoalForProgress(goal);
    setSelectedUserForProgress(userId || user?.id || '');
    setProgressValue('');
    setProgressDialogOpen(true);
  };

  const handleUpdateProgress = async () => {
    if (!selectedGoalForProgress || !progressValue) {
      toast.error('Preencha o valor do progresso');
      return;
    }

    setSaving(true);
    try {
      const { start, end } = getPeriodDates(selectedGoalForProgress.period_type);
      const periodStart = format(start, 'yyyy-MM-dd');
      const periodEnd = format(end, 'yyyy-MM-dd');
      const targetUserId = selectedUserForProgress || user?.id;

      // Check if progress exists for this period
      const { data: existingProgress } = await supabase
        .from('goal_progress')
        .select('id, current_value')
        .eq('goal_id', selectedGoalForProgress.id)
        .eq('user_id', targetUserId)
        .eq('period_start', periodStart)
        .single();

      if (existingProgress) {
        // Update existing progress
        const { error } = await supabase
          .from('goal_progress')
          .update({
            current_value: parseFloat(progressValue),
            updated_by: user?.id,
          })
          .eq('id', existingProgress.id);
        if (error) throw error;
      } else {
        // Insert new progress
        const { error } = await supabase.from('goal_progress').insert({
          goal_id: selectedGoalForProgress.id,
          user_id: targetUserId,
          current_value: parseFloat(progressValue),
          period_start: periodStart,
          period_end: periodEnd,
          updated_by: user?.id,
        });
        if (error) throw error;
      }

      toast.success('Progresso atualizado!');
      setProgressDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error updating progress:', error);
      toast.error('Erro ao atualizar progresso');
    } finally {
      setSaving(false);
    }
  };

  const filteredGoals = useMemo(() => {
    if (selectedTab === 'all') return goals;
    return goals.filter(g => g.period_type === selectedTab);
  }, [goals, selectedTab]);

  const stats = useMemo(() => {
    const totalGoals = goals.length;
    const achievedGoals = goals.filter(g => {
      const current = getProgressForGoal(g.id);
      return current >= g.target_value;
    }).length;
    const inProgressGoals = totalGoals - achievedGoals;

    return { totalGoals, achievedGoals, inProgressGoals };
  }, [goals, progress]);

  // Calculate seller ranking
  const sellerRanking = useMemo((): SellerRanking[] => {
    if (goals.length === 0 || users.length === 0) return [];

    const rankings: SellerRanking[] = users.map(userProfile => {
      let totalProgress = 0;
      let totalTargets = 0;
      let goalsAchieved = 0;

      goals.forEach(goal => {
        const { start } = getPeriodDates(goal.period_type);
        const periodStart = format(start, 'yyyy-MM-dd');
        
        const userProgress = progress.filter(
          p => p.goal_id === goal.id && 
               p.user_id === userProfile.id && 
               p.period_start === periodStart
        );
        
        const currentValue = userProgress.reduce((sum, p) => sum + p.current_value, 0);
        totalProgress += currentValue;
        totalTargets += goal.target_value;
        
        if (currentValue >= goal.target_value) {
          goalsAchieved++;
        }
      });

      const percentage = totalTargets > 0 ? Math.round((totalProgress / totalTargets) * 100) : 0;

      return {
        userId: userProfile.id,
        userName: userProfile.full_name,
        region: userProfile.region,
        totalProgress,
        totalTargets,
        percentage,
        goalsAchieved,
      };
    });

    // Sort by percentage descending
    return rankings
      .filter(r => r.totalProgress > 0 || r.goalsAchieved > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }, [goals, progress, users]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="w-7 h-7 text-primary" />
              Metas
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe suas metas e progresso
            </p>
          </div>
          {isDev && (
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Meta
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-full">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Metas</p>
                  <p className="text-2xl font-bold">{stats.totalGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-full">
                  <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metas Batidas</p>
                  <p className="text-2xl font-bold">{stats.achievedGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-full">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Progresso</p>
                  <p className="text-2xl font-bold">{stats.inProgressGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seller Ranking */}
        {sellerRanking.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Ranking de Vendedores
              </CardTitle>
              <CardDescription>
                Classificação baseada no progresso de todas as metas ativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sellerRanking.slice(0, 10).map((seller, index) => {
                  const isTop3 = index < 3;
                  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
                  
                  return (
                    <div
                      key={seller.userId}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isTop3 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                          isTop3 ? 'bg-primary/20' : 'bg-muted'
                        }`}>
                          {isTop3 ? (
                            <Medal className={`w-4 h-4 ${medalColors[index]}`} />
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{seller.userName}</p>
                          {seller.region && (
                            <p className="text-xs text-muted-foreground">
                              {seller.region}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {seller.percentage}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {seller.goalsAchieved}/{goals.length} metas
                          </p>
                        </div>
                        <div className="w-24">
                          <Progress value={Math.min(seller.percentage, 100)} className="h-2" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for filtering */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="daily">Diárias</TabsTrigger>
            <TabsTrigger value="weekly">Semanais</TabsTrigger>
            <TabsTrigger value="monthly">Mensais</TabsTrigger>
            <TabsTrigger value="yearly">Anuais</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            {filteredGoals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma meta encontrada</h3>
                  <p className="text-muted-foreground">
                    {isAdmin
                      ? 'Crie uma nova meta para começar a acompanhar o progresso.'
                      : 'Aguarde a criação de metas pelo administrador.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredGoals.map(goal => {
                  const currentProgress = getProgressForGoal(goal.id);
                  const percentage = calculatePercentage(currentProgress, goal.target_value);
                  const isAchieved = currentProgress >= goal.target_value;
                  const teamProgress = isAdmin ? getTeamProgressForGoal(goal.id) : null;

                  return (
                    <Card
                      key={goal.id}
                      className={`relative overflow-hidden transition-all ${
                        isAchieved ? 'border-green-500/50 bg-green-500/5' : ''
                      }`}
                    >
                      {isAchieved && (
                        <div className="absolute top-3 right-3">
                          <Trophy className="w-6 h-6 text-green-500" />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={periodColors[goal.period_type]}
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                {periodLabels[goal.period_type]}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{goal.title}</CardTitle>
                            {goal.description && (
                              <CardDescription className="mt-1">
                                {goal.description}
                              </CardDescription>
                            )}
                          </div>
                          {isDev && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(goal)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteGoal(goal.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* User's own progress */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Seu progresso</span>
                            <span className="font-semibold">
                              {currentProgress.toLocaleString('pt-BR')} / {goal.target_value.toLocaleString('pt-BR')} {goal.unit}
                            </span>
                          </div>
                          <Progress value={percentage} className="h-3" />
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-medium ${
                                isAchieved ? 'text-green-500' : 'text-muted-foreground'
                              }`}
                            >
                              {percentage}% completo
                            </span>
                            {isDev && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenProgressDialog(goal)}
                                className="gap-1"
                              >
                                <TrendingUp className="w-3 h-3" />
                                Atualizar
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Team progress (admin only) */}
                        {isAdmin && teamProgress && teamProgress.users.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Progresso da Equipe</span>
                            </div>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {teamProgress.users.slice(0, 5).map((up, idx) => {
                                const userPercentage = calculatePercentage(
                                  up.value,
                                  goal.target_value
                                );
                                const userAchieved = up.value >= goal.target_value;
                                return (
                                  <div
                                    key={up.userId}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      {idx === 0 && teamProgress.users.length > 1 && (
                                        <ChevronUp className="w-3 h-3 text-green-500" />
                                      )}
                                      <span className="truncate max-w-[120px]">
                                        {up.profile?.full_name || 'Usuário'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-medium ${
                                          userAchieved ? 'text-green-500' : ''
                                        }`}
                                      >
                                        {up.value.toLocaleString('pt-BR')} ({userPercentage}%)
                                      </span>
                                      {isDev && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleOpenProgressDialog(goal, up.userId)}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Editar Meta' : 'Nova Meta'}
            </DialogTitle>
            <DialogDescription>
              {editingGoal
                ? 'Edite os detalhes da meta.'
                : 'Defina uma nova meta para a equipe acompanhar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Vendas do mês"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a meta..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_value">Valor Alvo *</Label>
                <Input
                  id="target_value"
                  type="number"
                  value={formData.target_value}
                  onChange={e => setFormData({ ...formData, target_value: e.target.value })}
                  placeholder="100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unidade</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="unidades"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_type">Período</Label>
              <Select
                value={formData.period_type}
                onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly') =>
                  setFormData({ ...formData, period_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visível para</Label>
              <div className="flex flex-wrap gap-3">
                {allRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.visible_to_roles.includes(role)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            visible_to_roles: [...formData.visible_to_roles, role],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            visible_to_roles: formData.visible_to_roles.filter(r => r !== role),
                          });
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGoal} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGoal ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar Progresso</DialogTitle>
            <DialogDescription>
              {selectedGoalForProgress?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isDev && (
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select
                  value={selectedUserForProgress}
                  onValueChange={setSelectedUserForProgress}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="progress_value">
                Valor atual ({selectedGoalForProgress?.unit})
              </Label>
              <Input
                id="progress_value"
                type="number"
                value={progressValue}
                onChange={e => setProgressValue(e.target.value)}
                placeholder={`Meta: ${selectedGoalForProgress?.target_value}`}
              />
              <p className="text-xs text-muted-foreground">
                Meta: {selectedGoalForProgress?.target_value?.toLocaleString('pt-BR')}{' '}
                {selectedGoalForProgress?.unit}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateProgress} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Goals;
