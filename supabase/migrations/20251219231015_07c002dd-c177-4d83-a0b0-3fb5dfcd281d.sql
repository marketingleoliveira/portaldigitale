-- Create tickets table
CREATE TABLE public.tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL DEFAULT 'suporte',
    status text NOT NULL DEFAULT 'aberto',
    priority text NOT NULL DEFAULT 'normal',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create ticket_messages table for conversation
CREATE TABLE public.ticket_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    message text NOT NULL,
    is_admin_reply boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets
CREATE POLICY "Users can view own tickets"
ON public.tickets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets"
ON public.tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
ON public.tickets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
ON public.tickets FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all tickets"
ON public.tickets FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ticket_messages
CREATE POLICY "Users can view messages from own tickets"
ON public.ticket_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
        AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Users can create messages on own tickets"
ON public.ticket_messages FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
        AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Admins can create messages on any ticket"
ON public.ticket_messages FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id
);

-- Trigger to update updated_at
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();