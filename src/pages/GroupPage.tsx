import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Lock, Globe, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string;
  avatar_url: string | null;
}

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchGroup = async () => {
    if (!groupId || !user) return;
    const [{ data: g }, { data: memberships }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_memberships").select("id, user_id, role").eq("group_id", groupId),
    ]);
    setGroup(g);
    const myMembership = memberships?.find(m => m.user_id === user.id);
    setJoined(!!myMembership);
    setIsGroupAdmin(myMembership?.role === "admin" || g?.created_by === user.id);

    // Fetch member profiles
    if (memberships && memberships.length > 0) {
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setMembers(memberships.map(m => {
        const p = profileMap.get(m.user_id);
        return { ...m, name: p?.name || "User", avatar_url: p?.avatar_url || null };
      }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchGroup(); }, [groupId, user]);

  const handleToggleJoin = async () => {
    if (!user || !groupId) return;
    if (joined) {
      await supabase.from("group_memberships").delete().eq("group_id", groupId).eq("user_id", user.id);
      setJoined(false);
      toast.success("Left group");
      fetchGroup();
    } else {
      await supabase.from("group_memberships").insert({ group_id: groupId, user_id: user.id });
      setJoined(true);
      toast.success("Joined group!");
      fetchGroup();
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (!isGroupAdmin || memberUserId === user?.id) return;
    await supabase.from("group_memberships").delete().eq("id", memberId);
    toast.success("Member removed");
    fetchGroup();
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
          <span>{members.length} members</span>
        </div>
        {group.description && <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>}
        <button onClick={handleToggleJoin} className={`mt-3 w-full rounded-lg py-2.5 text-sm font-medium ${joined ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"}`}>
          {joined ? "Leave Group" : "Join Group"}
        </button>
      </div>

      {/* Members list */}
      <div className="mt-2 bg-card px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground mb-3">Members</h3>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${m.user_id}`)}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full bg-muted object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">{m.name[0]?.toUpperCase()}</div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  {m.role === "admin" && <span className="text-[10px] text-primary font-medium">Admin</span>}
                </div>
              </div>
              {isGroupAdmin && m.user_id !== user?.id && (
                <button onClick={() => handleRemoveMember(m.id, m.user_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupPage;
