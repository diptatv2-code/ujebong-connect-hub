
-- Add reaction_type column to post_likes
ALTER TABLE public.post_likes ADD COLUMN reaction_type text NOT NULL DEFAULT 'like';
