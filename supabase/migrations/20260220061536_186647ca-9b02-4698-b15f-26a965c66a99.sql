
-- Create call sessions table
CREATE TABLE public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own calls"
ON public.call_sessions FOR SELECT
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can create calls"
ON public.call_sessions FOR INSERT
WITH CHECK (caller_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Participants can update calls"
ON public.call_sessions FOR UPDATE
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Participants can delete calls"
ON public.call_sessions FOR DELETE
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- Enable realtime for call signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
