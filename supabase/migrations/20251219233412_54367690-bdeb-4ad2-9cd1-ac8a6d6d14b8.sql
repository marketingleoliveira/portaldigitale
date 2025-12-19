-- Enable realtime for tickets table (for status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;