import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasFullAccess } from '@/types/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  Users, 
  FolderOpen, 
  Activity, 
  TrendingUp, 
  FileText, 
  Bell,
  HelpCircle,
  TicketIcon,
  ArrowRight,
  Clock
} from 'lucide-react';
import RoleBadge from '@/components/RoleBadge';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import OnlineUsersCard from '@/components/OnlineUsersCard';

interface DashboardStats {
  totalProducts: number;
  totalUsers: number;
  totalCategories: number;
  recentLogs: number;
  totalFiles: number;
  unreadNotifications: number;
  openTickets: number;
}

interface RecentActivity {
  type: 'product' | 'notification' | 'file';
  title: string;
  date: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUsers: 0,
    totalCategories: 0,
    recentLogs: 0,
    totalFiles: 0,
    unreadNotifications: 0,
    openTickets: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        // Fetch categories count
        const { count: categoriesCount } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true });

        // Fetch files count
        const { count: filesCount } = await supabase
          .from('files')
          .select('*', { count: 'exact', head: true });

        // Fetch open tickets for the user
        const { count: ticketsCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto');

        // Admin/Dev-only stats
        let usersCount = 0;
        let logsCount = 0;

        if (hasFullAccess(user?.role)) {
          const { count: users } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          usersCount = users || 0;

          const { count: logs } = await supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true });
          logsCount = logs || 0;
        }

        // Fetch recent activities
        const { data: recentProducts } = await supabase
          .from('products')
          .select('name, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        const activities: RecentActivity[] = (recentProducts || []).map(p => ({
          type: 'product' as const,
          title: p.name,
          date: p.created_at,
        }));

        setRecentActivities(activities);

        setStats({
          totalProducts: productsCount || 0,
          totalUsers: usersCount,
          totalCategories: categoriesCount || 0,
          recentLogs: logsCount,
          totalFiles: filesCount || 0,
          unreadNotifications: 0,
          openTickets: ticketsCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.role]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statsCards = [
    {
      title: 'Categorias',
      value: stats.totalCategories,
      icon: FolderOpen,
      description: 'Organizando arquivos',
      color: 'text-success',
      bgColor: 'bg-success/10',
      href: '/categorias',
      roles: ['dev', 'admin', 'gerente'],
    },
    {
      title: 'Arquivos',
      value: stats.totalFiles,
      icon: FileText,
      description: 'Materiais disponíveis',
      color: 'text-role-gerente',
      bgColor: 'bg-role-gerente/10',
      href: '/downloads',
      roles: ['dev', 'admin', 'gerente', 'vendedor'],
    },
    {
      title: 'Usuários',
      value: stats.totalUsers,
      icon: Users,
      description: 'Ativos no sistema',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      href: '/usuarios',
      roles: ['dev', 'admin'],
    },
    {
      title: 'Acessos',
      value: stats.recentLogs,
      icon: Activity,
      description: 'Logs registrados',
      color: 'text-role-admin',
      bgColor: 'bg-role-admin/10',
      href: '/relatorios',
      roles: ['dev', 'admin'],
    },
  ];

  const filteredStats = statsCards.filter(card => 
    user?.role && (card.roles.includes(user.role) || user.role === 'dev')
  );

  const quickActions = [
    {
      title: 'Materiais Comerciais',
      description: 'Fichas técnicas e catálogos',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/downloads',
      roles: ['dev', 'admin', 'gerente', 'vendedor'],
    },
    {
      title: 'Notificações',
      description: 'Veja os avisos recentes',
      icon: Bell,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      href: '/notificacoes',
      roles: ['dev', 'admin', 'gerente'],
    },
    {
      title: 'Central de Ajuda',
      description: 'Guias e suporte',
      icon: HelpCircle,
      color: 'text-role-gerente',
      bgColor: 'bg-role-gerente/10',
      href: '/ajuda',
      roles: ['dev', 'admin', 'gerente', 'vendedor'],
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Cadastro e permissões',
      icon: Users,
      color: 'text-role-admin',
      bgColor: 'bg-role-admin/10',
      href: '/usuarios',
      roles: ['dev', 'admin'],
    },
  ];

  const filteredActions = quickActions.filter(action => 
    user?.role && (action.roles.includes(user.role) || user.role === 'dev')
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {user?.profile?.full_name?.split(' ')[0] || 'Usuário'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Confira as informações do seu painel
            </p>
          </div>
          {user?.role && (
            <RoleBadge role={user.role} />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {hasFullAccess(user?.role) && (
            <OnlineUsersCard />
          )}
          {filteredStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.title} to={stat.href}>
                <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold mt-1">
                          {loading ? '-' : stat.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.description}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais funcionalidades
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link 
                    key={action.href} 
                    to={action.href}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className={`p-2 rounded-lg ${action.bgColor}`}>
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Support & Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="w-5 h-5 text-primary" />
                Suporte
              </CardTitle>
              <CardDescription>
                Precisa de ajuda?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link 
                to="/tickets" 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TicketIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Meus Chamados</p>
                    {stats.openTickets > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        {stats.openTickets} aberto{stats.openTickets > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link 
                to="/tickets/novo" 
                className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <HelpCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Abrir Chamado</p>
                    <p className="text-xs text-muted-foreground">Reportar erro ou solicitar ajuda</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link 
                to="/ajuda" 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-role-gerente/10">
                    <HelpCircle className="w-5 h-5 text-role-gerente" />
                  </div>
                  <div>
                    <p className="font-medium">Central de Ajuda</p>
                    <p className="text-xs text-muted-foreground">Guias e tutoriais</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Role Info & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Seu Nível de Acesso
              </CardTitle>
              <CardDescription>
                Informações sobre suas permissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user?.role && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <RoleBadge role={user.role} />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-2">
                    {user.role === 'dev' && (
                      <>
                        <p>✓ Acesso total ao sistema</p>
                        <p>✓ Controle de desenvolvimento</p>
                        <p>✓ Gerenciamento de usuários</p>
                        <p>✓ Todas as funcionalidades</p>
                        <p>✓ Suporte técnico</p>
                      </>
                    )}
                    {user.role === 'admin' && (
                      <>
                        <p>✓ Acesso total ao sistema</p>
                        <p>✓ Gerenciamento de usuários</p>
                        <p>✓ Cadastro e edição de produtos</p>
                        <p>✓ Visualização de relatórios</p>
                        <p>✓ Controle de permissões</p>
                      </>
                    )}
                    {user.role === 'gerente' && (
                      <>
                        <p>✓ Acesso a dados essenciais</p>
                        <p>✓ Edição de produtos</p>
                        <p>✓ Relatórios da equipe</p>
                        <p>✓ Gestão de vendedores</p>
                      </>
                    )}
                    {user.role === 'vendedor' && (
                      <>
                        <p>✓ Catálogo de produtos</p>
                        <p>✓ Materiais comerciais</p>
                        <p>✓ Visualização da equipe</p>
                        <p>✓ Abertura de tickets</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Produtos Recentes
              </CardTitle>
              <CardDescription>
                Últimos produtos adicionados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum produto recente</p>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.date && format(new Date(activity.date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
