-- Fix RLS policy for user_locations to allow proper UPSERT operations
-- The WITH CHECK is required for UPDATE operations in UPSERT

-- Drop and recreate the update policy with proper WITH CHECK
DROP POLICY IF EXISTS "Users can update own location" ON public.user_locations;

CREATE POLICY "Users can update own location" 
ON public.user_locations 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);