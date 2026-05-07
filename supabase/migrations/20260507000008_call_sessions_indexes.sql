-- BUG-054: Add indexes to support the most common call_sessions lookups
-- ("calls I received recently", "calls I made recently"). Without these,
-- profile-page call history and the global incoming-call listener do
-- sequential scans.

CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver
  ON public.call_sessions(receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller
  ON public.call_sessions(caller_id, created_at DESC);
