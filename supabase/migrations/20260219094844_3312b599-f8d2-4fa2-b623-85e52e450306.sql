
-- Restrict data access to approved users only (unapproved users should not browse content)

-- Posts: only approved users can view
DROP POLICY "Anyone can view posts" ON public.posts;
CREATE POLICY "Approved users can view posts" ON public.posts
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- Post comments: only approved users can view
DROP POLICY "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Approved users can view comments" ON public.post_comments
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- Post likes: only approved users can view
DROP POLICY "Anyone can view likes" ON public.post_likes;
CREATE POLICY "Approved users can view likes" ON public.post_likes
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- Group memberships: only approved users can view
DROP POLICY "Anyone can view memberships" ON public.group_memberships;
CREATE POLICY "Approved users can view memberships" ON public.group_memberships
FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

-- Profiles: approved users see all, unapproved see only own, admins see all
DROP POLICY "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid() 
  OR public.is_approved(auth.uid()) 
  OR public.has_role(auth.uid(), 'admin')
);

-- Also restrict write operations to approved users (prevent unapproved users from posting)
-- Posts insert
DROP POLICY "Users can create own posts" ON public.posts;
CREATE POLICY "Approved users can create posts" ON public.posts
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

-- Comments insert
DROP POLICY "Users can comment" ON public.post_comments;
CREATE POLICY "Approved users can comment" ON public.post_comments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

-- Likes insert
DROP POLICY "Users can like" ON public.post_likes;
CREATE POLICY "Approved users can like" ON public.post_likes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

-- Friendships insert
DROP POLICY "Users can send requests" ON public.friendships;
CREATE POLICY "Approved users can send requests" ON public.friendships
FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid() AND public.is_approved(auth.uid()));
