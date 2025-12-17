import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Package, Users, FolderOpen, Activity, TrendingUp, Eye } from 'lucide-react';
import RoleBadge from '@/components/RoleBadge';

interface DashboardStats {
  totalProducts: number;
  totalUsers: number;
  totalCategories: number;
  recentLogs: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUsers: 0,
    totalCategories: 0,
    recentLogs: 0,
  });
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

        // Admin-only stats
        let usersCount = 0;
        let logsCount = 0;

        if (user?.role === 'admin') {
          const { count: users } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          usersCount = users || 0;

          const { count: logs } = await supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true });
          logsCount = logs || 0;
        }

        setStats({
          totalProducts: productsCount || 0,
          totalUsers: usersCount,
          totalCategories: categoriesCount || 0,
          recentLogs: logsCount,
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
      title: 'Produtos',
      value: stats.totalProducts,
      icon: Package,
      description: 'Total cadastrados',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      roles: ['admin', 'gerente', 'vendedor'],
    },
    {
      title: 'Categorias',
      value: stats.totalCategories,
      icon: FolderOpen,
      description: 'Disponíveis',
      color: 'text-success',
      bgColor: 'bg-success/10',
      roles: ['admin', 'gerente', 'vendedor'],
    },
    {
      title: 'Usuários',
      value: stats.totalUsers,
      icon: Users,
      description: 'Ativos no sistema',
      color: 'text-role-gerente',
      bgColor: 'bg-role-gerente/10',
      roles: ['admin'],
    },
    {
      title: 'Acessos',
      value: stats.recentLogs,
      icon: Activity,
      description: 'Logs registrados',
      color: 'text-role-admin',
      bgColor: 'bg-role-admin/10',
      roles: ['admin'],
    },
  ];

  const filteredStats = statsCards.filter(card => 
    user?.role && card.roles.includes(user.role)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
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
            );
          })}
        </div>

        {/* Role-specific Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais funcionalidades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href="/produtos" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Ver Produtos</p>
                  <p className="text-sm text-muted-foreground">Acesse o catálogo completo</p>
                </div>
              </a>
              <a href="/downloads" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <Eye className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium">Downloads</p>
                  <p className="text-sm text-muted-foreground">Materiais e fichas técnicas</p>
                </div>
              </a>
              {user?.role === 'admin' && (
                <a href="/usuarios" className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Users className="w-5 h-5 text-role-admin" />
                  <div>
                    <p className="font-medium">Gerenciar Usuários</p>
                    <p className="text-sm text-muted-foreground">Cadastro e permissões</p>
                  </div>
                </a>
              )}
            </CardContent>
          </Card>

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
                        <p>✓ Visualização de produtos</p>
                        <p>✓ Relatórios básicos</p>
                        <p>✓ Conteúdo de gerência e vendedores</p>
                      </>
                    )}
                    {user.role === 'vendedor' && (
                      <>
                        <p>✓ Catálogo de produtos liberados</p>
                        <p>✓ Downloads autorizados</p>
                        <p>✓ Notificações da equipe</p>
                      </>
                    )}
                  </div>
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
