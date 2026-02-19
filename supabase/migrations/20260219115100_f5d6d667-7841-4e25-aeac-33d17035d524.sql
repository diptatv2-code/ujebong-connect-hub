
-- Create storage bucket for signup selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can upload their own selfie
CREATE POLICY "Users can upload own selfie"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read access for admin review
CREATE POLICY "Selfies are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'selfies');

-- Add selfie_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_url text DEFAULT '';
