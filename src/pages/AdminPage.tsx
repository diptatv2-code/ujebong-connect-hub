import { useState, useEffect } from "react";
import { ArrowLeft, Check, X, Shield, UserCheck, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  selfie_url: string | null;
  bio: string | null;
  is_approved: boolean;
  created_at: string;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, selfie_url, bio, is_approved, created_at")
      .order("created_at", { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleApprove = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ is_approved: true }).eq("id", userId);
    if (error) { toast.error("Failed to approve"); return; }
    toast.success("User approved!");
    fetchProfiles();
  };

  const handleRevoke = async (userId: string) => {
    if (userId === user?.id) { toast.error("You can't revoke your own access"); return; }
    const { error } = await supabase.from("profiles").update({ is_approved: false }).eq("id", userId);
    if (error) { toast.error("Failed to revoke"); return; }
    toast.success("Access revoked");
    fetchProfiles();
  };

  const filtered = profiles.filter((p) => {
    if (filter === "pending") return !p.is_approved;
    if (filter === "approved") return p.is_approved;
    return true;
  });

  const pendingCount = profiles.filter((p) => !p.is_approved).length;

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="pb-16">
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={22} className="text-foreground" /></button>
        <Shield size={20} className="text-primary" />
        <h2 className="text-base font-semibold text-foreground">Admin Panel</h2>
      </div>

      <div className="pt-14">
        <div className="flex border-b border-border bg-card">
          {(["pending", "approved", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${filter === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              {tab}{tab === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>

        <div className="space-y-1 bg-muted p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {filter === "pending" ? "No pending users 🎉" : "No users found"}
            </p>
          ) : (
            <div className="rounded-xl bg-card p-4 space-y-3">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${p.id}`)}>
                    <div className="relative">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {p.name?.[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                      {p.selfie_url && !p.is_approved && (
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-card overflow-hidden">
                          <img src={p.selfie_url} alt="Selfie" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.name || "Unnamed"}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {p.is_approved ? (
                          <><UserCheck size={12} className="text-success" /> Approved</>
                        ) : (
                          <><Clock size={12} className="text-warning" /> Pending</>
                        )}
                      </div>
                      {p.selfie_url && !p.is_approved && (
                        <a href={p.selfie_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-primary" onClick={e => e.stopPropagation()}>
                          View selfie →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!p.is_approved ? (
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check size={16} />
                      </button>
                    ) : (
                      p.id !== user?.id && (
                        <button
                          onClick={() => handleRevoke(p.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        >
                          <X size={16} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
