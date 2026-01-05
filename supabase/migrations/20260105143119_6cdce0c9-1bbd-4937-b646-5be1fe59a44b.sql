-- Add policy for DEV users to update all time records
CREATE POLICY "Dev can update all time records"
ON public.time_records
FOR UPDATE
USING (has_role(auth.uid(), 'dev'::app_role))
WITH CHECK (has_role(auth.uid(), 'dev'::app_role));