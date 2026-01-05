-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true);

-- Create ticket_attachments table
CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments from their tickets
CREATE POLICY "Users can view attachments from own tickets"
ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Users can insert attachments to their tickets
CREATE POLICY "Users can insert attachments to own tickets"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Storage policies for ticket attachments bucket
CREATE POLICY "Authenticated users can upload ticket attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view ticket attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Users can delete own ticket attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);