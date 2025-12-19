-- Allow gerentes to manage products (in addition to admins)
CREATE POLICY "Gerentes can manage products" 
ON public.products 
FOR ALL 
USING (has_role(auth.uid(), 'gerente'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role));

-- Allow gerentes to manage product visibility
CREATE POLICY "Gerentes can manage visibility" 
ON public.product_visibility 
FOR ALL 
USING (has_role(auth.uid(), 'gerente'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role));