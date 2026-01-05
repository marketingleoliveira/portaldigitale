import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading while auth or user data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User exists but profile not yet loaded - show loading
  if (!user.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User not active - awaiting approval
  if (!user.profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Aguardando Aprovação</h1>
          <p className="text-muted-foreground mb-4">
            Seu cadastro está sendo analisado por um administrador. Você receberá acesso ao portal assim que for aprovado.
          </p>
          <p className="text-sm text-muted-foreground">
            Em caso de dúvidas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  // Role-based access check (DEV has full access)
  if (allowedRoles && user.role) {
    const hasAccess = allowedRoles.includes(user.role) || user.role === 'dev';
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // If role check required but user has no role, redirect to dashboard
  if (allowedRoles && !user.role) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
