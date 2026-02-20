
-- Group posts table
CREATE TABLE public.group_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;

-- Members can view posts in their groups (or public groups)
CREATE POLICY "Members can view group posts"
ON public.group_posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_posts.group_id
    AND (g.is_public = true OR g.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
    ))
  )
);

-- Members can create posts
CREATE POLICY "Members can create group posts"
ON public.group_posts FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_posts.group_id AND gm.user_id = auth.uid()
  )
);

-- Users can delete own posts
CREATE POLICY "Users can delete own group posts"
ON public.group_posts FOR DELETE
USING (user_id = auth.uid());

-- Group admins can delete any post
CREATE POLICY "Group admins can delete group posts"
ON public.group_posts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_posts.group_id AND g.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_posts.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

-- Users can update own posts (for editing)
CREATE POLICY "Users can update own group posts"
ON public.group_posts FOR UPDATE
USING (user_id = auth.uid());

-- Group admins can pin/unpin posts
CREATE POLICY "Group admins can update group posts"
ON public.group_posts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_posts.group_id AND g.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_posts.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

-- Group post comments
CREATE TABLE public.group_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group post comments"
ON public.group_post_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_posts gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.id = group_post_comments.post_id
    AND (g.is_public = true OR g.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_memberships gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Members can comment on group posts"
ON public.group_post_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.group_posts gp
    JOIN public.group_memberships gm ON gm.group_id = gp.group_id
    WHERE gp.id = group_post_comments.post_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own group comments"
ON public.group_post_comments FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Group admins can delete group comments"
ON public.group_post_comments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.group_posts gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.id = group_post_comments.post_id
    AND (g.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.group_id = g.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    ))
  )
);

-- Group post likes/reactions
CREATE TABLE public.group_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.group_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group post likes"
ON public.group_post_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_posts gp
    JOIN public.groups g ON g.id = gp.group_id
    WHERE gp.id = group_post_likes.post_id
    AND (g.is_public = true OR g.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_memberships gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Members can like group posts"
ON public.group_post_likes FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.group_posts gp
    JOIN public.group_memberships gm ON gm.group_id = gp.group_id
    WHERE gp.id = group_post_likes.post_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can unlike group posts"
ON public.group_post_likes FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Users can update own group reactions"
ON public.group_post_likes FOR UPDATE
USING (user_id = auth.uid());

-- Group join requests (for private groups)
CREATE TABLE public.group_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can request to join"
ON public.group_join_requests FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Users can view own requests"
ON public.group_join_requests FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Group admins can view requests"
ON public.group_join_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_join_requests.group_id AND g.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_join_requests.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

CREATE POLICY "Group admins can update requests"
ON public.group_join_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_join_requests.group_id AND g.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_join_requests.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

CREATE POLICY "Users can cancel own requests"
ON public.group_join_requests FOR DELETE
USING (user_id = auth.uid());

-- Add storage bucket for group post images
INSERT INTO storage.buckets (id, name, public) VALUES ('group-posts', 'group-posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can upload group post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'group-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view group post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-posts');

CREATE POLICY "Users can delete own group post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'group-posts' AND auth.uid()::text = (storage.foldername(name))[1]);
