
-- Create table for development updates
CREATE TABLE public.development_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.development_updates ENABLE ROW LEVEL SECURITY;

-- Everyone can read published updates
CREATE POLICY "Anyone can view published updates"
ON public.development_updates
FOR SELECT
USING (is_published = true);

-- DEV can manage all updates
CREATE POLICY "DEV can manage updates"
ON public.development_updates
FOR ALL
USING (public.has_role(auth.uid(), 'dev'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.development_updates;
