-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Admins can manage subcategories
CREATE POLICY "Admins can manage subcategories"
ON public.subcategories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view subcategories
CREATE POLICY "Authenticated users can view subcategories"
ON public.subcategories
FOR SELECT
USING (true);

-- Add subcategory_id to files table
ALTER TABLE public.files ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;