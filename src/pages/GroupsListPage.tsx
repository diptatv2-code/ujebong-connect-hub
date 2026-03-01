import { useState, useEffect } from "react";
import { Plus, Users, Globe, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_photo_url: string | null;
  member_count: number;
  is_public: boolean;
  created_by: string;
  isMember: boolean;
}

const GroupsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);

  const fetchGroups = async () => {
    if (!user) return;
    const { data: allGroups } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    const { data: memberships } = await supabase.from("group_memberships").select("group_id").eq("user_id", user.id);
    const memberSet = new Set((memberships || []).map(m => m.group_id));
    setGroups((allGroups || []).map(g => ({ ...g, isMember: memberSet.has(g.id) || g.created_by === user.id })));
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("groups").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      created_by: user.id,
      is_public: newIsPublic,
    }).select().single();
    if (error) { toast.error("Failed to create group"); return; }
    await supabase.from("group_memberships").insert({ group_id: data.id, user_id: user.id, role: "admin" });
    toast.success("Group created!");
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setNewIsPublic(true);
    fetchGroups();
  };

  const handleJoin = async (groupId: string) => {
    if (!user) return;
    const group = groups.find(g => g.id === groupId);
    if (group && !group.is_public) {
      // Request to join private group
      await supabase.from("group_join_requests").insert({ group_id: groupId, user_id: user.id });
      toast.success("Join request sent!");
      return;
    }
    await supabase.from("group_memberships").insert({ group_id: groupId, user_id: user.id });
    toast.success("Joined group!");
    fetchGroups();
  };

  return (
    <div className="pb-16 pt-header">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h2 className="text-lg font-bold text-foreground">Groups</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          <Plus size={14} /> Create
        </button>
      </div>

      {showCreate && (
        <div className="border-b border-border bg-card p-4 space-y-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name" className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNewIsPublic(true)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${newIsPublic ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
            >
              <Globe size={12} /> Public
            </button>
            <button
              onClick={() => setNewIsPublic(false)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${!newIsPublic ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
            >
              <Lock size={12} /> Private
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Create Group</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg bg-secondary px-4 py-2 text-xs font-medium text-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-1 bg-muted p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No groups yet. Create the first one!</p>
        ) : (
          groups.map(g => (
            <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => navigate(`/group/${g.id}`)}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20">
                  <Users size={20} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{g.name}</p>
                    {g.is_public ? <Globe size={10} className="text-muted-foreground" /> : <Lock size={10} className="text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{g.member_count} members · {g.is_public ? "Public" : "Private"}</p>
                </div>
              </div>
              {!g.isMember ? (
                <button onClick={() => handleJoin(g.id)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  {g.is_public ? "Join" : "Request"}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Joined</span>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default GroupsListPage;
