-- Update RLS policy for vendedores to allow INTERNO region to see all files
DROP POLICY IF EXISTS "Vendedores can view price files based on region" ON public.price_files;

CREATE POLICY "Vendedores can view price files based on region" 
ON public.price_files 
FOR SELECT 
USING (
  has_role(auth.uid(), 'vendedor'::app_role) AND (
    -- INTERNO (Vendedor Interno) can see all files
    (SELECT profiles.region FROM profiles WHERE profiles.id = auth.uid()) = 'INTERNO'
    OR
    -- Files with no region (all regions)
    region IS NULL 
    OR
    -- Files matching user's region
    region = (SELECT profiles.region FROM profiles WHERE profiles.id = auth.uid()) 
    OR
    -- Users with no region see all files
    (SELECT profiles.region FROM profiles WHERE profiles.id = auth.uid()) IS NULL
  )
);