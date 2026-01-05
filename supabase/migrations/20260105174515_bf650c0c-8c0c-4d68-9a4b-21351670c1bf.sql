-- Allow DEV role to delete goal_progress records
CREATE POLICY "Devs can delete goal progress"
ON public.goal_progress
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));