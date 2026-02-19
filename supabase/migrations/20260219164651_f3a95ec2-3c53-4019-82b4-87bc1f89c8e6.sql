
-- Drop the overly permissive policy and replace with a trigger-only approach
-- Since notifications are inserted by SECURITY DEFINER triggers, we can restrict direct inserts
DROP POLICY "System can insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches current user (covers edge cases)
-- The SECURITY DEFINER triggers bypass RLS anyway
CREATE POLICY "Triggers can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());
