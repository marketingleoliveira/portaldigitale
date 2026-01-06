-- Create table for location history
CREATE TABLE public.user_location_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    ip_address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    city TEXT,
    region TEXT,
    country TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_user_location_history_user_id ON public.user_location_history(user_id);
CREATE INDEX idx_user_location_history_recorded_at ON public.user_location_history(recorded_at);

-- Enable Row Level Security
ALTER TABLE public.user_location_history ENABLE ROW LEVEL SECURITY;

-- Only devs can view all location history
CREATE POLICY "Devs can view all location history" 
ON public.user_location_history 
FOR SELECT 
USING (has_role(auth.uid(), 'dev'::app_role));

-- Users can insert their own location history
CREATE POLICY "Users can insert own location history" 
ON public.user_location_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Devs can delete old records (for cleanup)
CREATE POLICY "Devs can delete location history" 
ON public.user_location_history 
FOR DELETE 
USING (has_role(auth.uid(), 'dev'::app_role));

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_location_history;