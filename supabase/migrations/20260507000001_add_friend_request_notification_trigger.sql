-- BUG-007: Friend-request notifications were missing — no DB trigger fired when
-- a friendships row was inserted. Add a trigger that mirrors the like/comment/
-- message triggers and inserts a notification for the addressee.

CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id, created_at)
  VALUES (NEW.addressee_id, 'friend_request', NEW.requester_id, NOW())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_friendship_request_notify ON public.friendships;
CREATE TRIGGER on_friendship_request_notify
  AFTER INSERT ON public.friendships
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_on_friend_request();
