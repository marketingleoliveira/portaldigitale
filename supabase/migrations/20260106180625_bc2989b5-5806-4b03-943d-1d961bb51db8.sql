-- Add column to store location sharing preference
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean DEFAULT NULL;

-- NULL = never asked, true = accepted, false = declined

COMMENT ON COLUMN public.profiles.location_sharing_enabled IS 'User preference for automatic location sharing. NULL = not yet asked, true = accepted, false = declined';