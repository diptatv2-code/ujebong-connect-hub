import { useState, useEffect } from "react";
import { ArrowLeft, Check, X, Shield, UserCheck, Clock, Flag, Trash2, BadgeCheck } from "lucide-react";
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
  is_verified: boolean;
  created_at: string;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  status: string;
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "reports">("users");
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, selfie_url, bio, is_approved, is_verified, created_at")
      .order("created_at", { ascending: false });
    setProfiles(data || []);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const userIds = [...new Set([...data.map(r => r.reporter_id), ...data.map(r => r.reported_user_id).filter(Boolean)])];
      const { data: profs } = await supabase.from("profiles").select("id, name").in("id", userIds as string[]);
      const nameMap = new Map((profs || []).map(p => [p.id, p.name]));
      setReports(data.map(r => ({
        ...r,
        reporter_name: nameMap.get(r.reporter_id) || "Unknown",
        reported_name: r.reported_user_id ? nameMap.get(r.reported_user_id) || "Unknown" : "N/A",
      })));
    }
  };

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchReports()]).then(() => setLoading(false));
  }, []);

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

  const handleToggleVerified = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_verified: !current }).eq("id", userId);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(current ? "Badge removed" : "User verified!");
    fetchProfiles();
  };

  const handleDeletePost = async (postId: string) => {
    await supabase.from("post_likes").delete().eq("post_id", postId);
    await supabase.from("post_comments").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
    toast.success("Post deleted");
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("post_comments").delete().eq("id", commentId);
    toast.success("Comment deleted");
  };

  const handleResolveReport = async (reportId: string, action: "resolved" | "dismissed") => {
    await supabase.from("reports").update({ status: action, resolved_at: new Date().toISOString(), resolved_by: user?.id }).eq("id", reportId);
    toast.success(`Report ${action}`);
    fetchReports();
  };

  const filtered = profiles.filter((p) => {
    if (filter === "pending") return !p.is_approved;
    if (filter === "approved") return p.is_approved;
    return true;
  });

  const pendingCount = profiles.filter((p) => !p.is_approved).length;
  const pendingReports = reports.filter(r => r.status === "pending").length;

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="pb-16">
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={22} className="text-foreground" /></button>
        <Shield size={20} className="text-primary" />
        <h2 className="text-base font-semibold text-foreground">Admin Panel</h2>
      </div>

      <div className="pt-14">
        {/* Main Tabs: Users | Reports */}
        <div className="flex border-b border-border bg-card">
          <button onClick={() => setTab("users")} className={`flex-1 py-3 text-sm font-medium ${tab === "users" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Users {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button onClick={() => setTab("reports")} className={`flex-1 py-3 text-sm font-medium ${tab === "reports" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            Reports {pendingReports > 0 && <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{pendingReports}</span>}
          </button>
        </div>

        {tab === "users" && (
          <>
            <div className="flex border-b border-border bg-card">
              {(["pending", "approved", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize ${filter === f ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                >{f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}</button>
              ))}
            </div>

            <div className="space-y-1 bg-muted p-2">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">{filter === "pending" ? "No pending users 🎉" : "No users found"}</p>
              ) : (
                <div className="rounded-xl bg-card p-4 space-y-3">
                  {filtered.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${p.id}`)}>
                        <div className="relative">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" />
                          ) : (
                            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{p.name?.[0]?.toUpperCase() || "U"}</div>
                          )}
                          {p.selfie_url && !p.is_approved && (
                            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-card overflow-hidden">
                              <img src={p.selfie_url} alt="Selfie" className="h-full w-full object-cover" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold text-foreground">{p.name || "Unnamed"}</p>
                            {p.is_verified && <BadgeCheck size={14} className="text-primary" />}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {p.is_approved ? <><UserCheck size={12} className="text-green-500" /> Approved</> : <><Clock size={12} className="text-yellow-500" /> Pending</>}
                          </div>
                          {p.selfie_url && !p.is_approved && (
                            <a href={p.selfie_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-primary" onClick={e => e.stopPropagation()}>View selfie →</a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleToggleVerified(p.id, p.is_verified)} title={p.is_verified ? "Remove badge" : "Give badge"}
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${p.is_verified ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                          <BadgeCheck size={16} />
                        </button>
                        {!p.is_approved ? (
                          <button onClick={() => handleApprove(p.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={16} /></button>
                        ) : (
                          p.id !== user?.id && (
                            <button onClick={() => handleRevoke(p.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground"><X size={16} /></button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "reports" && (
          <div className="space-y-1 bg-muted p-2">
            {reports.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No reports yet 🎉</p>
            ) : (
              <div className="rounded-xl bg-card p-4 space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className={`rounded-lg border p-3 space-y-2 ${r.status === "pending" ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flag size={14} className={r.status === "pending" ? "text-destructive" : "text-muted-foreground"} />
                        <span className="text-xs font-medium text-foreground">
                          {r.post_id ? "Post" : "Comment"} reported by {r.reporter_name}
                        </span>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        r.status === "pending" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
                      }`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Against: {r.reported_name}</p>
                    <p className="text-xs text-foreground">{r.reason}</p>
                    {r.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        {r.post_id && (
                          <button onClick={() => { handleDeletePost(r.post_id!); handleResolveReport(r.id, "resolved"); }}
                            className="flex items-center gap-1 rounded bg-destructive px-2 py-1 text-[10px] text-destructive-foreground">
                            <Trash2 size={10} /> Delete Post
                          </button>
                        )}
                        {r.comment_id && (
                          <button onClick={() => { handleDeleteComment(r.comment_id!); handleResolveReport(r.id, "resolved"); }}
                            className="flex items-center gap-1 rounded bg-destructive px-2 py-1 text-[10px] text-destructive-foreground">
                            <Trash2 size={10} /> Delete Comment
                          </button>
                        )}
                        <button onClick={() => handleResolveReport(r.id, "dismissed")}
                          className="rounded bg-secondary px-2 py-1 text-[10px] text-foreground">Dismiss</button>
                      </div>
                    )}
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

export default AdminPage;
