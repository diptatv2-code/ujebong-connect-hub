import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Lock, Globe, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!groupId || !user) return;
      const [{ data: g }, { data: membership }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase.from("group_memberships").select("id").eq("group_id", groupId).eq("user_id", user.id),
      ]);
      setGroup(g);
      setJoined((membership?.length ?? 0) > 0);
      setLoading(false);
    };
    fetch();
  }, [groupId, user]);

  const handleToggleJoin = async () => {
    if (!user || !groupId) return;
    if (joined) {
      await supabase.from("group_memberships").delete().eq("group_id", groupId).eq("user_id", user.id);
      setJoined(false);
      toast.success("Left group");
    } else {
      await supabase.from("group_memberships").insert({ group_id: groupId, user_id: user.id });
      setJoined(true);
      toast.success("Joined group!");
    }
  };

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!group) return <div className="pt-20 text-center text-muted-foreground">Group not found</div>;

  return (
    <div className="pb-16">
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={22} className="text-foreground" /></button>
        <h2 className="flex-1 truncate text-base font-semibold text-foreground">{group.name}</h2>
      </div>

      <div className="pt-12">
        {group.cover_photo_url ? (
          <div className="h-40 overflow-hidden bg-muted"><img src={group.cover_photo_url} alt="" className="h-full w-full object-cover" /></div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-primary/30 to-primary/10" />
        )}
      </div>

      <div className="bg-card px-4 py-4">
        <h1 className="text-lg font-bold text-foreground">{group.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {group.is_public ? <Globe size={12} /> : <Lock size={12} />}
          <span>{group.is_public ? "Public" : "Private"}</span>
          <span>·</span>
          <Users size={12} />
          <span>{group.member_count} members</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
        <button onClick={handleToggleJoin} className={`mt-3 w-full rounded-lg py-2.5 text-sm font-medium ${joined ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"}`}>
          {joined ? "Leave Group" : "Join Group"}
        </button>
      </div>
    </div>
  );
};

export default GroupPage;
