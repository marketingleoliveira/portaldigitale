-- Allow all authenticated users to view goal_progress for ranking purposes
CREATE POLICY "Authenticated users can view all progress for ranking"
ON public.goal_progress
FOR SELECT
USING (true);