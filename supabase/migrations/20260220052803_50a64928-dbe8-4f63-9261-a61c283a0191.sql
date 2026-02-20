-- 1. Make selfies bucket private
UPDATE storage.buckets SET public = false WHERE id = 'selfies';

-- Drop public read policy
DROP POLICY IF EXISTS "Selfies are publicly accessible" ON storage.objects;

-- Only owners and admins can view selfies
CREATE POLICY "Owners and admins can view selfies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'selfies' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    public.has_role(auth.uid(), 'admin')
  )
);

-- 2. Update profiles SELECT policy to hide selfie_url from non-owners/non-admins
-- We'll use a view approach: update profiles_safe view to exclude selfie_url for non-owners
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
  SELECT 
    id, name, avatar_url, bio, cover_photo_url, is_approved, created_at, updated_at,
    CASE 
      WHEN id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN selfie_url
      ELSE NULL
    END AS selfie_url
  FROM public.profiles;
