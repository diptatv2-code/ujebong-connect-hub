
-- Update the email trigger function to use hardcoded URL (safe since it's public info)
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wcdplljxjuyacpkbipwu.supabase.co/functions/v1/send-notification-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHBsbGp4anV5YWNwa2JpcHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODM2ODEsImV4cCI6MjA4NzA1OTY4MX0.Bj6uZFmZq1GEmaD-vR2xwBEM7E4YaOoBQEH4K2hnLno"}'::jsonb,
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
