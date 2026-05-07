-- BUG-053: A messages row with content/image_url/audio_url all NULL was
-- previously allowed at the DB level (the frontend prevented it but a direct
-- SQL/RPC call could insert empty rows). Add a CHECK so the DB enforces it.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_not_all_null;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_not_all_null
  CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0)
    OR image_url IS NOT NULL
    OR audio_url IS NOT NULL
  );
