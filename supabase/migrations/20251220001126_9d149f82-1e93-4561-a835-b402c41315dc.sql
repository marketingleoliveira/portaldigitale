-- Create or replace the has_role function to include dev with admin privileges
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role 
        OR (role = 'dev' AND _role = 'admin')
      )
  )
$$;

-- Create a function to check if user is dev or admin (for full access)
CREATE OR REPLACE FUNCTION public.has_full_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'dev')
  )
$$;

-- Update get_user_role to include dev
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'dev' THEN 0
      WHEN 'admin' THEN 1 
      WHEN 'gerente' THEN 2 
      WHEN 'vendedor' THEN 3 
    END
  LIMIT 1
$$;