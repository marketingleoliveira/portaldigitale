-- Add policy for users to view their own location
CREATE POLICY "Users can view own location" 
ON public.user_locations 
FOR SELECT 
USING (auth.uid() = user_id);