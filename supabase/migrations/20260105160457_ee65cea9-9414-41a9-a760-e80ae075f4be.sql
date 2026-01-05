-- Add goal_type to distinguish between team and individual goals
-- Add target_user_id for individual goals
ALTER TABLE public.goals 
ADD COLUMN goal_type text NOT NULL DEFAULT 'team',
ADD COLUMN target_user_id uuid REFERENCES auth.users(id);

-- Add check constraint to ensure individual goals have a target user
ALTER TABLE public.goals
ADD CONSTRAINT goals_individual_must_have_user CHECK (
  (goal_type = 'team') OR (goal_type = 'individual' AND target_user_id IS NOT NULL)
);

-- Create index for faster queries
CREATE INDEX idx_goals_goal_type ON public.goals(goal_type);
CREATE INDEX idx_goals_target_user_id ON public.goals(target_user_id);