-- Add is_external_link column to files table
ALTER TABLE public.files 
ADD COLUMN is_external_link boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.files.is_external_link IS 'When true, file_url is treated as an external link to access instead of a file to download';