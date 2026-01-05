-- Add policy for DEV users to view all time records
CREATE POLICY "Dev can view all time records"
ON public.time_records
FOR SELECT
USING (has_role(auth.uid(), 'dev'::app_role));