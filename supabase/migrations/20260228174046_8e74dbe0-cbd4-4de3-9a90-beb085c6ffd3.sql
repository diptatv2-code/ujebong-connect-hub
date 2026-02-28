
-- =============================================
-- CULTURAL EVENTS
-- =============================================
CREATE TABLE public.cultural_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  end_date DATE,
  location TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT 'all',
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'festival',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cultural_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view events" ON public.cultural_events FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Approved users can create events" ON public.cultural_events FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "Users can update own events" ON public.cultural_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own events" ON public.cultural_events FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete any event" ON public.cultural_events FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- COMMUNITY POLLS
-- =============================================
CREATE TABLE public.community_polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  description TEXT DEFAULT '',
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view polls" ON public.community_polls FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Approved users can create polls" ON public.community_polls FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "Users can delete own polls" ON public.community_polls FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete any poll" ON public.community_polls FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.poll_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.community_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view poll options" ON public.poll_options FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Poll creators can add options" ON public.poll_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.community_polls WHERE id = poll_options.poll_id AND user_id = auth.uid())
);

CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.community_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view votes" ON public.poll_votes FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Approved users can vote" ON public.poll_votes FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "Users can change vote" ON public.poll_votes FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- JOB PORTAL
-- =============================================
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  job_type TEXT NOT NULL DEFAULT 'full-time',
  salary_range TEXT DEFAULT '',
  contact_info TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view active jobs" ON public.jobs FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Approved users can post jobs" ON public.jobs FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete any job" ON public.jobs FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- SCHOLARSHIP BOARD
-- =============================================
CREATE TABLE public.scholarships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  eligibility TEXT DEFAULT '',
  deadline DATE,
  link TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'scholarship',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view scholarships" ON public.scholarships FOR SELECT USING (is_approved(auth.uid()));
CREATE POLICY "Approved users can post scholarships" ON public.scholarships FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "Users can update own scholarships" ON public.scholarships FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own scholarships" ON public.scholarships FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete any scholarship" ON public.scholarships FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update any scholarship" ON public.scholarships FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for polls (live voting)
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
