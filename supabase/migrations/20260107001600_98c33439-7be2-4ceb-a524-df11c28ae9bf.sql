-- Update RLS policy to allow all authenticated users to view activity sessions for ranking
DROP POLICY IF EXISTS "Admins and devs can view all activity sessions" ON public.user_activity_sessions;

CREATE POLICY "Authenticated users can view all activity sessions"
ON public.user_activity_sessions
FOR SELECT
USING (true);