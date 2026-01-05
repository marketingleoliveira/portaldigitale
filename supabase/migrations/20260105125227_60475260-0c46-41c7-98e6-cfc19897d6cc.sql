-- Allow DEV users to delete any time records
CREATE POLICY "Dev can delete time records"
ON public.time_records
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));