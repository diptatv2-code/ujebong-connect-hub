-- BUG-009: The send_notification_email() function had a hardcoded anon JWT
-- in its body, which makes key rotation painful. Switch to current_setting()
-- with a fallback to the existing hardcoded value (so already-deployed
-- environments keep working until the GUC is set with
--   ALTER DATABASE postgres SET app.settings.supabase_anon_key = '...'
-- ) and gate the trigger to skip 'like' notifications, which the receiving
-- function noops on anyway.

CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  anon_key text;
BEGIN
  anon_key := COALESCE(
    current_setting('app.settings.supabase_anon_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHBsbGp4anV5YWNwa2JpcHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODM2ODEsImV4cCI6MjA4NzA1OTY4MX0.Bj6uZFmZq1GEmaD-vR2xwBEM7E4YaOoBQEH4K2hnLno'
  );

  PERFORM net.http_post(
    url := 'https://wcdplljxjuyacpkbipwu.supabase.co/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'type', NEW.type,
      'actor_id', NEW.actor_id,
      'content', COALESCE(NEW.content, '')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_send_email ON public.notifications;
CREATE TRIGGER on_notification_send_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW WHEN (NEW.type IN ('comment', 'message', 'friend_request'))
  EXECUTE FUNCTION public.send_notification_email();
