-- Permitir que todos os usuários autenticados vejam todos os perfis ativos (para página de equipe)
CREATE POLICY "Authenticated users can view all active profiles" 
ON public.profiles 
FOR SELECT 
USING (is_active = true);

-- Permitir que todos os usuários autenticados vejam todos os roles (para página de equipe)
CREATE POLICY "Authenticated users can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (true);