import { useState, useEffect } from "react";
import { Search, Users, Hash, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SearchPage = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "people" | "groups">("all");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: p }, { data: g }] = await Promise.all([
        supabase.from("profiles").select("id, name, avatar_url, bio").neq("id", user?.id ?? ""),
        supabase.from("groups").select("*"),
      ]);
      setProfiles(p || []);
      setGroups(g || []);
    };
    fetchAll();
  }, [user]);

  const filteredUsers = profiles.filter((u) => u.name?.toLowerCase().includes(query.toLowerCase()));
  const filteredGroups = groups.filter((g: any) => g.name?.toLowerCase().includes(query.toLowerCase()));

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: targetId });
    toast.success("Friend request sent!");
  };

  return (
    <div className="pb-16 pt-14">
      <div className="bg-card px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
          <Search size={18} className="text-muted-foreground" />
          <input type="text" placeholder="Search Ujebong..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
      </div>

      <div className="flex border-b border-border bg-card">
        {(["all", "people", "groups"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-sm font-medium capitalize ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>{tab}</button>
        ))}
      </div>

      <div className="space-y-2 bg-muted p-2">
        {(activeTab === "all" || activeTab === "people") && (
          <div className="rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2"><Users size={16} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">People</h3></div>
            {filteredUsers.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">No users found</p>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between">
                    <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${u.id}`)}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" /> : <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{u.name?.[0]}</div>}
                      <div><p className="text-sm font-semibold text-foreground">{u.name}</p><p className="text-xs text-muted-foreground">{u.bio || "New to Ujebong"}</p></div>
                    </div>
                    <button onClick={() => sendRequest(u.id)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><UserPlus size={12} /> Add</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === "all" || activeTab === "groups") && (
          <div className="rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2"><Hash size={16} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">Groups</h3></div>
            {filteredGroups.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">No groups found</p>
            ) : (
              <div className="space-y-3">
                {filteredGroups.map((group: any) => (
                  <div key={group.id} className="cursor-pointer overflow-hidden rounded-xl border border-border" onClick={() => navigate(`/group/${group.id}`)}>
                    {group.cover_photo_url && <div className="h-20 overflow-hidden bg-muted"><img src={group.cover_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" /></div>}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.member_count} members · {group.is_public ? "Public" : "Private"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
