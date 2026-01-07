-- Create table for price files
CREATE TABLE public.price_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    region TEXT, -- NULL means visible to all regions
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.price_files ENABLE ROW LEVEL SECURITY;

-- Policy: Dev and admin can do everything
CREATE POLICY "Dev and admin full access to price_files"
ON public.price_files
FOR ALL
USING (public.has_full_access(auth.uid()));

-- Policy: Vendedores can view based on region
CREATE POLICY "Vendedores can view price files based on region"
ON public.price_files
FOR SELECT
USING (
    public.has_role(auth.uid(), 'vendedor') AND (
        region IS NULL OR
        region = (SELECT region FROM public.profiles WHERE id = auth.uid()) OR
        (SELECT region FROM public.profiles WHERE id = auth.uid()) IS NULL
    )
);

-- Policy: Gerentes can view all
CREATE POLICY "Gerentes can view all price files"
ON public.price_files
FOR SELECT
USING (public.has_role(auth.uid(), 'gerente'));

-- Create trigger for updated_at
CREATE TRIGGER update_price_files_updated_at
BEFORE UPDATE ON public.price_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for price files
INSERT INTO storage.buckets (id, name, public) VALUES ('price-files', 'price-files', true);

-- Storage policies
CREATE POLICY "Anyone can view price files"
ON storage.objects FOR SELECT
USING (bucket_id = 'price-files');

CREATE POLICY "Dev and admin can upload price files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'price-files' AND public.has_full_access(auth.uid()));

CREATE POLICY "Dev and admin can update price files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'price-files' AND public.has_full_access(auth.uid()));

CREATE POLICY "Dev and admin can delete price files"
ON storage.objects FOR DELETE
USING (bucket_id = 'price-files' AND public.has_full_access(auth.uid()));