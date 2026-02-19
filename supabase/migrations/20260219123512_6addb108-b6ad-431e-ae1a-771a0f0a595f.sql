
-- Fix: Unapproved user profiles should not be visible to regular approved users
-- Only admins and the user themselves should see unapproved profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (public.is_approved(auth.uid()) AND is_approved = true)
);
