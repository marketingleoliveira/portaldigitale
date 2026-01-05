-- Create time_records table for attendance tracking
CREATE TABLE public.time_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_time timestamp with time zone,
  lunch_exit_time timestamp with time zone,
  lunch_return_time timestamp with time zone,
  exit_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, record_date)
);

-- Enable RLS
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own records
CREATE POLICY "Users can view own time records"
ON public.time_records
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own records
CREATE POLICY "Users can insert own time records"
ON public.time_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own records
CREATE POLICY "Users can update own time records"
ON public.time_records
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all records
CREATE POLICY "Admins can view all time records"
ON public.time_records
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all records
CREATE POLICY "Admins can manage all time records"
ON public.time_records
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_time_records_updated_at
BEFORE UPDATE ON public.time_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();