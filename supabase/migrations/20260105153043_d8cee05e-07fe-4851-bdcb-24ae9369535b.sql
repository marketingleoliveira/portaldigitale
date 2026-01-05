-- Add region column to profiles (for vendedor sub-role)
ALTER TABLE public.profiles 
ADD COLUMN region text DEFAULT NULL;

-- Create table for file region visibility
CREATE TABLE public.file_region_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  region text NOT NULL,
  UNIQUE(file_id, region)
);

-- Enable RLS
ALTER TABLE public.file_region_visibility ENABLE ROW LEVEL SECURITY;

-- Admins can manage file region visibility
CREATE POLICY "Admins can manage file region visibility"
ON public.file_region_visibility
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

-- Users can view visibility for files they can access
CREATE POLICY "Users can view file region visibility"
ON public.file_region_visibility
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM files f 
    WHERE f.id = file_region_visibility.file_id 
    AND can_view_file(auth.uid(), f.id)
  )
);

-- Update can_view_file function to check region for vendedores
CREATE OR REPLACE FUNCTION public.can_view_file(_user_id uuid, _file_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
  user_region text;
  has_role_access boolean;
  has_region_restriction boolean;
  has_region_access boolean;
BEGIN
  -- Get user's role
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Admins and devs can see everything
  IF user_role IN ('admin', 'dev') THEN
    RETURN true;
  END IF;
  
  -- Check if user has role-based access
  SELECT EXISTS (
    SELECT 1 FROM file_visibility fv 
    WHERE fv.file_id = _file_id AND fv.visible_to_role = user_role
  ) INTO has_role_access;
  
  -- If no role access, deny
  IF NOT has_role_access THEN
    RETURN false;
  END IF;
  
  -- If user is vendedor, check region restrictions
  IF user_role = 'vendedor' THEN
    -- Check if file has region restrictions
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv WHERE frv.file_id = _file_id
    ) INTO has_region_restriction;
    
    -- If no region restrictions, allow access
    IF NOT has_region_restriction THEN
      RETURN true;
    END IF;
    
    -- Get user's region
    SELECT region INTO user_region FROM profiles WHERE id = _user_id;
    
    -- If user has no region, deny access to region-restricted files
    IF user_region IS NULL THEN
      RETURN false;
    END IF;
    
    -- Check if user's region has access
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv 
      WHERE frv.file_id = _file_id AND frv.region = user_region
    ) INTO has_region_access;
    
    RETURN has_region_access;
  END IF;
  
  -- For other roles, just role access is enough
  RETURN true;
END;
$$;