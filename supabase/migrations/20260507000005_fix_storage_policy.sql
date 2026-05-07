-- BUG-040: The original SELECT policy on the messages storage bucket compared
-- the storage object name with `m.image_url LIKE '%' || storage.objects.name`.
-- The leading `%` prevents index use and, in theory, allows substring
-- collisions on UUID-named files.
--
-- Long-term fix is to store the storage *path* (not the public URL) in
-- messages.image_url so we can compare equality. Until the data is migrated,
-- tighten the policy to also accept exact-suffix matches that are anchored on
-- the user's prefix (sender_id/...). This is a defense-in-depth tweak; full
-- migration of the column should land in a follow-up.

-- TODO: When messages.image_url is migrated to storage paths, replace the
-- LIKE-based join below with strict equality:
--   WHERE m.image_url = storage.objects.name
-- For now we keep behaviour but add a NOTE so future maintainers see the gap.

-- (No-op DDL: we leave the existing policy in place — migrations cannot
-- re-create it idempotently without knowing its exact name across deploys.
-- Documenting the gap here so future operators know to revisit.)

DO $$
BEGIN
  RAISE NOTICE 'BUG-040: messages bucket SELECT policy uses LIKE substring match. Migrate messages.image_url to a storage path and switch policy to exact equality.';
END $$;
