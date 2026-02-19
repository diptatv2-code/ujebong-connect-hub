
-- Fix #1: Allow admins to update any profile (for approval/revocation)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix #2: Add length constraints to prevent DoS via oversized content
ALTER TABLE public.posts ADD CONSTRAINT posts_content_length CHECK (char_length(content) <= 5000);
ALTER TABLE public.post_comments ADD CONSTRAINT comments_content_length CHECK (char_length(content) <= 2000);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_name_length CHECK (char_length(name) <= 100);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length CHECK (char_length(bio) <= 500);
ALTER TABLE public.groups ADD CONSTRAINT groups_name_length CHECK (char_length(name) <= 200);
ALTER TABLE public.groups ADD CONSTRAINT groups_description_length CHECK (char_length(description) <= 2000);
