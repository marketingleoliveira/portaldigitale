-- Create files table for downloadable resources
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create file visibility table for role-based access
CREATE TABLE public.file_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  visible_to_role app_role NOT NULL,
  UNIQUE(file_id, visible_to_role)
);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_visibility ENABLE ROW LEVEL SECURITY;

-- Create function to check if user can view file
CREATE OR REPLACE FUNCTION public.can_view_file(_user_id UUID, _file_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.file_visibility fv
    JOIN public.user_roles ur ON ur.user_id = _user_id
    WHERE fv.file_id = _file_id
    AND (
      ur.role = 'admin'
      OR fv.visible_to_role = ur.role
      OR (ur.role = 'gerente' AND fv.visible_to_role IN ('gerente', 'vendedor'))
    )
  )
$$;

-- RLS policies for files
CREATE POLICY "Admins can manage files" ON public.files
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view allowed files" ON public.files
FOR SELECT USING (can_view_file(auth.uid(), id));

-- RLS policies for file_visibility
CREATE POLICY "Admins can manage file visibility" ON public.file_visibility
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view visibility for their files" ON public.file_visibility
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = file_visibility.file_id
    AND can_view_file(auth.uid(), f.id)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true);

-- Storage policies
CREATE POLICY "Admins can upload files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'files' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update files" ON storage.objects
FOR UPDATE USING (bucket_id = 'files' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete files" ON storage.objects
FOR DELETE USING (bucket_id = 'files' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view files" ON storage.objects
FOR SELECT USING (bucket_id = 'files');