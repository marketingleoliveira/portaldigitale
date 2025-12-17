-- Create notification_reads table to track read notifications
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_notification_id uuid REFERENCES user_notifications(id) ON DELETE CASCADE,
  read_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, notification_id),
  UNIQUE(user_id, user_notification_id)
);

-- Enable RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Users can manage their own reads
CREATE POLICY "Users can insert own reads"
ON public.notification_reads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reads"
ON public.notification_reads FOR SELECT
USING (auth.uid() = user_id);