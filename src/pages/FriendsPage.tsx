import { useState, useEffect } from "react";
import { UserPlus, UserCheck, Clock, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  name: string;
  avatar_url: string;
  bio: string;
}

interface FriendshipData {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

const FriendsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "friends" | "requests">("all");
  const [allProfiles, setAllProfiles] = useState<ProfileData[]>([]);
  const [friendships, setFriendships] = useState<FriendshipData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: profiles }, { data: ships }] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url, bio").neq("id", user.id),
      supabase.from("friendships").select("id, requester_id, addressee_id, status"),
    ]);
    setAllProfiles(profiles || []);
    setFriendships(ships || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    const ch = supabase.channel("friendships-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const getFriendStatus = (profileId: string) => {
    const ship = friendships.find(
      (f) => (f.requester_id === user?.id && f.addressee_id === profileId) ||
             (f.addressee_id === user?.id && f.requester_id === profileId)
    );
    if (!ship) return "none";
    if (ship.status === "accepted") return "friends";
    if (ship.requester_id === user?.id) return "sent";
    return "received";
  };

  const getFriendship = (profileId: string) =>
    friendships.find(
      (f) => (f.requester_id === user?.id && f.addressee_id === profileId) ||
             (f.addressee_id === user?.id && f.requester_id === profileId)
    );

  const sendRequest = async (targetId: string) => {
    await supabase.from("friendships").insert({ requester_id: user!.id, addressee_id: targetId });
    toast.success("Friend request sent!");
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    toast.success("Friend request accepted!");
  };

  const removeFriend = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
  };

  const friends = allProfiles.filter((p) => getFriendStatus(p.id) === "friends");
  const received = allProfiles.filter((p) => getFriendStatus(p.id) === "received");
  const suggestions = allProfiles.filter((p) => getFriendStatus(p.id) === "none");

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="pb-16 pt-14">
      <div className="flex border-b border-border bg-card">
        {(["all", "friends", "requests"] as const).map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)} className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${filter === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            {tab}{tab === "requests" && received.length > 0 ? ` (${received.length})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-1 bg-muted p-2">
        {/* Incoming Requests */}
        {(filter === "all" || filter === "requests") && received.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Friend Requests ({received.length})</h3>
            <div className="space-y-3">
              {received.map((p) => {
                const ship = getFriendship(p.id)!;
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${p.id}`)}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" /> : <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{p.name[0]}</div>}
                      <div><p className="text-sm font-semibold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">Wants to be your friend</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => acceptRequest(ship.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={16} /></button>
                      <button onClick={() => removeFriend(ship.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground"><X size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Friends */}
        {(filter === "all" || filter === "friends") && friends.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Your Friends ({friends.length})</h3>
            <div className="space-y-3">
              {friends.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                  <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${p.id}`)}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" /> : <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{p.name[0]}</div>}
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  </div>
                  <button onClick={() => removeFriend(getFriendship(p.id)!.id)} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">
                    <UserCheck size={14} /> Friends
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {filter === "all" && suggestions.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Suggested Friends</h3>
            <div className="space-y-3">
              {suggestions.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${p.id}`)}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" /> : <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{p.name[0]}</div>}
                    <div><p className="text-sm font-semibold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.bio || "New to Ujebong"}</p></div>
                  </div>
                  <button onClick={() => sendRequest(p.id)} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                    <UserPlus size={14} /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {allProfiles.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No other users yet. Share the app!</p>}
      </div>
    </div>
  );
};

export default FriendsPage;
