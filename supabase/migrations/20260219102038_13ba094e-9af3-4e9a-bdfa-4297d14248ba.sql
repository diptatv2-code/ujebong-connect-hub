
-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT DEFAULT '',
  image_url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Approved users can send messages
CREATE POLICY "Approved users can send messages"
ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND is_approved(auth.uid()));

-- Users can view their own messages
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Users can update messages they received (for read_at)
CREATE POLICY "Receivers can mark as read"
ON public.messages FOR UPDATE
USING (receiver_id = auth.uid());

-- Users can delete their own sent messages
CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create storage bucket for message images
INSERT INTO storage.buckets (id, name, public) VALUES ('messages', 'messages', true);

-- Storage policies for message images
CREATE POLICY "Authenticated users can upload message images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'messages' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view message images"
ON storage.objects FOR SELECT
USING (bucket_id = 'messages');

-- Index for faster conversation lookups
CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id, created_at DESC);
