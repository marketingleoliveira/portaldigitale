import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import RoleBadge from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FolderOpen,
  BarChart3,
  FileText,
  User,
  Upload,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UnreadNotificationsAlert from '@/components/UnreadNotificationsAlert';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: ('admin' | 'gerente' | 'vendedor')[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Catálogo de Produtos', href: '/produtos', icon: Package, roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Categorias', href: '/categorias', icon: FolderOpen, roles: ['admin'] },
  { label: 'Usuários', href: '/usuarios', icon: Users, roles: ['admin'] },
  { label: 'Arquivos', href: '/arquivos', icon: Upload, roles: ['admin'] },
  { label: 'Relatórios', href: '/relatorios', icon: BarChart3, roles: ['admin', 'gerente'] },
  { label: 'Materiais Comerciais', href: '/downloads', icon: FileText, roles: ['admin', 'gerente', 'vendedor'] },
  { label: 'Notificações', href: '/notificacoes', icon: Bell, roles: ['admin', 'gerente', 'vendedor'] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount } = useUnreadNotifications();

  const filteredNavItems = navItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 gradient-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <Logo className="text-sidebar-foreground" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-2">
              {user?.profile?.avatar_url ? (
                <img
                  src={user.profile.avatar_url}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover border border-sidebar-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.profile?.full_name || 'Usuário'}
                </p>
                {user?.role && <RoleBadge role={user.role} size="sm" showIcon={false} />}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-card border-b border-border">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold hidden sm:block">
                {filteredNavItems.find(item => 
                  location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                )?.label || 'Portal'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => navigate('/notificacoes')}
              >
                <Bell className="w-5 h-5" />
                {unreadCount.total > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {unreadCount.total > 9 ? '9+' : unreadCount.total}
                  </span>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    {user?.profile?.avatar_url ? (
                      <img
                        src={user.profile.avatar_url}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="hidden sm:inline-block">
                      {user?.profile?.full_name?.split(' ')[0] || 'Usuário'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/perfil" className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Meu Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>

        {/* Unread Notifications Alert */}
        <UnreadNotificationsAlert />
      </div>
    </div>
  );
};

export default DashboardLayout;
