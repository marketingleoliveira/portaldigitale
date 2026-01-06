-- Create table for user locations
CREATE TABLE public.user_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    ip_address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    city TEXT,
    region TEXT,
    country TEXT,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Only devs can view all locations
CREATE POLICY "Devs can view all locations" 
ON public.user_locations 
FOR SELECT 
USING (has_role(auth.uid(), 'dev'::app_role));

-- Users can insert/update their own location
CREATE POLICY "Users can insert own location" 
ON public.user_locations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own location" 
ON public.user_locations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;