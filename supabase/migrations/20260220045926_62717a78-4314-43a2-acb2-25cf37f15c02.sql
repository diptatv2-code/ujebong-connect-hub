-- Allow group admins/creators to remove members
CREATE POLICY "Group admins can remove members"
ON public.group_memberships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE groups.id = group_memberships.group_id
    AND groups.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_memberships.group_id
    AND gm.user_id = auth.uid()
    AND gm.role = 'admin'
  )
);