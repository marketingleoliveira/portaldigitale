import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { signOut } = useAuth();

  useEffect(() => {
    // Desloga o usuário e redireciona para o portal externo
    const logoutAndRedirect = async () => {
      await signOut();
      window.location.href = 'https://portal.digitaletextil.com.br/';
    };
    logoutAndRedirect();
  }, [signOut]);

  // Mostra loading enquanto processa
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default Login;
