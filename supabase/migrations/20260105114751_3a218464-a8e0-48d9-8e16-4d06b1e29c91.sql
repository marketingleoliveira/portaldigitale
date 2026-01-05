-- Add IP address column to access_logs table
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS ip_address text;