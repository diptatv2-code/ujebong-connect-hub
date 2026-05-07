-- BUG-045: When a user creates a group, they should automatically be added as
-- an admin member. Previously this was done client-side and could fail silently,
-- leaving the creator locked out of their own private group.

CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.created_by, 'admin', NOW())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_created_add_creator ON public.groups;
CREATE TRIGGER on_group_created_add_creator
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_group_creator_as_admin();
