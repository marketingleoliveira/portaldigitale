-- Enable REPLICA IDENTITY FULL for files table to ensure realtime updates work
ALTER TABLE public.files REPLICA IDENTITY FULL;