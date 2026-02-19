
-- Recreate view with explicit SECURITY INVOKER to fix linter warning
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
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
