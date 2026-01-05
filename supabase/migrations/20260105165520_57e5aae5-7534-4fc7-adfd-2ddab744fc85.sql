-- Create table to store achieved goal certificates
CREATE TABLE public.achieved_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  goal_title TEXT NOT NULL,
  goal_value TEXT NOT NULL,
  period_type TEXT NOT NULL,
  achieved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, goal_id, achieved_date)
);

-- Enable RLS
ALTER TABLE public.achieved_certificates ENABLE ROW LEVEL SECURITY;

-- Users can view their own certificates
CREATE POLICY "Users can view own certificates"
ON public.achieved_certificates
FOR SELECT
USING (auth.uid() = user_id);

-- Devs and admins can view all certificates
CREATE POLICY "Devs and admins can view all certificates"
ON public.achieved_certificates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

-- Users can insert their own certificates
CREATE POLICY "Users can insert own certificates"
ON public.achieved_certificates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Devs can manage all certificates
CREATE POLICY "Devs can manage all certificates"
ON public.achieved_certificates
FOR ALL
USING (has_role(auth.uid(), 'dev'::app_role));