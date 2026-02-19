
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'like', 'comment', 'message'
  actor_id UUID NOT NULL,
  post_id UUID,
  message_id UUID,
  content TEXT DEFAULT '',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read_at) WHERE read_at IS NULL;

-- Trigger: on post_likes insert, create notification
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner UUID;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id)
    VALUES (post_owner, 'like', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_like_notify
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Trigger: on post_comments insert, create notification
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner UUID;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id, content)
    VALUES (post_owner, 'comment', NEW.user_id, NEW.post_id, LEFT(NEW.content, 100));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_comment_notify
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Trigger: on messages insert, create notification
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.sender_id != NEW.receiver_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, message_id, content)
    VALUES (NEW.receiver_id, 'message', NEW.sender_id, NEW.id, LEFT(COALESCE(NEW.content, ''), 100));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
