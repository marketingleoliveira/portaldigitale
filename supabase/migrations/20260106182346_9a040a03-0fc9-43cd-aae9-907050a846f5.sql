-- Add location_source column to user_locations
ALTER TABLE public.user_locations 
ADD COLUMN IF NOT EXISTS location_source text DEFAULT 'ip';

-- Add location_source column to user_location_history
ALTER TABLE public.user_location_history 
ADD COLUMN IF NOT EXISTS location_source text DEFAULT 'ip';