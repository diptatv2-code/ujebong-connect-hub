
-- Make messages bucket private
UPDATE storage.buckets SET public = false WHERE id = 'messages';

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can view message images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload message images" ON storage.objects;

-- Only conversation participants can view message images
CREATE POLICY "Conversation participants can view message images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'messages' AND
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.image_url LIKE '%' || storage.objects.name
    AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
);

-- Users can only upload to their own folder
CREATE POLICY "Users can upload own message images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'messages' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
