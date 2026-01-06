-- Add neighborhood and street columns to user_locations
ALTER TABLE public.user_locations 
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS street text;

-- Add neighborhood and street columns to user_location_history
ALTER TABLE public.user_location_history 
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS street text;