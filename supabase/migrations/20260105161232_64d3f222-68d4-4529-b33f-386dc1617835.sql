-- Allow DEV users to delete notifications
CREATE POLICY "Dev can delete notifications"
ON public.notifications
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));

-- Allow DEV users to delete user notifications
CREATE POLICY "Dev can delete user notifications"
ON public.user_notifications
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));

-- Allow DEV users to delete notification reads
CREATE POLICY "Dev can delete notification reads"
ON public.notification_reads
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));