-- BUG-018: Add 'missed' as a valid call_sessions.status. Unanswered calls now
-- transition to 'missed' (set by the caller's no-answer timeout in
-- useVoiceCall.startCall) instead of being left as 'ringing' forever or written
-- as 'ended' with duration=0.

ALTER TABLE public.call_sessions
  DROP CONSTRAINT IF EXISTS call_sessions_status_check;

ALTER TABLE public.call_sessions
  ADD CONSTRAINT call_sessions_status_check
  CHECK (status IN ('ringing', 'connected', 'ended', 'rejected', 'missed'));
