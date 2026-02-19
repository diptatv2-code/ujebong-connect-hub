
-- 1. Auto-approve users on signup: change default and update trigger
ALTER TABLE public.profiles ALTER COLUMN is_approved SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, is_approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), true);
  RETURN NEW;
END;
$$;

-- 2. Add audio_url column to messages
ALTER TABLE public.messages ADD COLUMN audio_url text DEFAULT NULL;

-- 3. Add audio_url column to post_comments
ALTER TABLE public.post_comments ADD COLUMN audio_url text DEFAULT NULL;

-- 4. Create voice-notes storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for voice-notes bucket
CREATE POLICY "Users can upload own voice notes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can read voice notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-notes' AND auth.role() = 'authenticated');
