
-- Create a secure view that hides selfie_url from non-owners/non-admins
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT
  id,
  name,
  avatar_url,
  bio,
  cover_photo_url,
  is_approved,
  created_at,
  updated_at,
  CASE
    WHEN id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN selfie_url
    ELSE NULL
  END AS selfie_url
FROM public.profiles;
