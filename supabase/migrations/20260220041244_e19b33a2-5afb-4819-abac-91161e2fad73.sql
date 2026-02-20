
-- 1. Fix post_likes UPDATE policy (reactions broken without this)
CREATE POLICY "Users can update own reactions"
ON public.post_likes
FOR UPDATE
USING (user_id = auth.uid());

-- 2. Admin can delete any post
CREATE POLICY "Admins can delete any post"
ON public.posts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Admin can delete any comment
CREATE POLICY "Admins can delete any comment"
ON public.post_comments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid,
  post_id uuid,
  comment_id uuid,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
ON public.reports FOR INSERT
WITH CHECK (reporter_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Users can view own reports"
ON public.reports FOR SELECT
USING (reporter_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
ON public.reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports"
ON public.reports FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Blocked users table
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can block others"
ON public.blocked_users FOR INSERT
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can view own blocks"
ON public.blocked_users FOR SELECT
USING (blocker_id = auth.uid());

CREATE POLICY "Users can unblock"
ON public.blocked_users FOR DELETE
USING (blocker_id = auth.uid());

-- 6. Add is_verified to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
