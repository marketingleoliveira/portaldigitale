-- Create user_presence table for tracking online/offline status
CREATE TABLE public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  session_started timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policies for user_presence
CREATE POLICY "Authenticated users can view all presence"
ON public.user_presence
FOR SELECT
USING (true);

CREATE POLICY "Users can insert own presence"
ON public.user_presence
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
ON public.user_presence
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Devs can delete presence"
ON public.user_presence
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));

-- Create user_activity_sessions table for tracking session durations
CREATE TABLE public.user_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_start timestamp with time zone NOT NULL DEFAULT now(),
  session_end timestamp with time zone,
  duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for user_activity_sessions
CREATE POLICY "Admins and devs can view all activity sessions"
ON public.user_activity_sessions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Users can insert own sessions"
ON public.user_activity_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.user_activity_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Devs can delete sessions"
ON public.user_activity_sessions
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role));

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;