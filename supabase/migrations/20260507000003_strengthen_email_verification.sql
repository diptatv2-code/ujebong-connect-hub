-- BUG-014: Add a SECURITY DEFINER helper that returns true only if the user's
-- profile has email_verified=true. RLS policies that need to require email
-- verification in addition to is_approved() can compose this check.
-- (We deliberately do NOT alter every existing policy here to avoid breaking
-- already-deployed environments — the helper is available for use; specific
-- policies can be tightened in a follow-up migration once tested in staging.)

CREATE OR REPLACE FUNCTION public.is_verified_user(user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT email_verified FROM public.profiles WHERE id = user_id),
    false
  );
$$;
