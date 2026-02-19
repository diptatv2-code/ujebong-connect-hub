import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, UserPlus, UserCheck, Camera, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/PostCard";
import type { PostWithProfile } from "@/pages/FeedsPage";
import { toast } from "sonner";

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isOwnProfile = userId === user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [friendStatus, setFriendStatus] = useState<"none" | "friends" | "sent" | "received">("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");

  useEffect(() => {
    const fetch = async () => {
      if (!userId || !user) return;

      const [{ data: prof }, { data: rawPosts }, { data: friendships }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("posts").select("id, user_id, content, image_url, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("friendships").select("*").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      ]);

      setProfile(prof);
      setEditName(prof?.name || "");
      setEditBio(prof?.bio || "");

      const acceptedFriendships = friendships?.filter((f: any) => f.status === "accepted") || [];
      setFriendCount(acceptedFriendships.length);

      // Check friendship status with current user
      const ship = friendships?.find(
        (f: any) => (f.requester_id === user.id && f.addressee_id === userId) ||
                    (f.addressee_id === user.id && f.requester_id === userId)
      );
      if (ship) {
        setFriendshipId(ship.id);
        if (ship.status === "accepted") setFriendStatus("friends");
        else if (ship.requester_id === user.id) setFriendStatus("sent");
        else setFriendStatus("received");
      }

      // Enrich posts
      if (rawPosts) {
        const postIds = rawPosts.map((p: any) => p.id);
        const [{ data: likes }, { data: comments }] = await Promise.all([
          supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
          supabase.from("post_comments").select("post_id").in("post_id", postIds),
        ]);
        setPosts(rawPosts.map((p: any) => ({
          ...p,
          profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null,
          like_count: likes?.filter((l: any) => l.post_id === p.id).length ?? 0,
          comment_count: comments?.filter((c: any) => c.post_id === p.id).length ?? 0,
          liked_by_me: likes?.some((l: any) => l.post_id === p.id && l.user_id === user.id) ?? false,
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [userId, user]);

  const handleLike = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
    // Refresh
    const { data: likes } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", posts.map(p => p.id));
    setPosts(prev => prev.map(p => ({
      ...p,
      like_count: likes?.filter(l => l.post_id === p.id).length ?? 0,
      liked_by_me: likes?.some(l => l.post_id === p.id && l.user_id === user.id) ?? false,
    })));
  };

  const handleComment = async (postId: string, content: string) => {
    if (!user) return;
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content });
  };

  const handleSendRequest = async () => {
    if (!user || !userId) return;
    await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: userId });
    setFriendStatus("sent");
    toast.success("Friend request sent!");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ name: editName, bio: editBio }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, name: editName, bio: editBio }));
    setEditing(false);
    toast.success("Profile updated!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const initial = profile?.name?.[0]?.toUpperCase() || "U";

  return (
    <div className="pb-16">
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={22} className="text-foreground" /></button>
        <h2 className="text-base font-semibold text-foreground">{profile?.name || "User"}</h2>
        {isOwnProfile && <button className="ml-auto" onClick={handleSignOut}><LogOut size={20} className="text-muted-foreground" /></button>}
      </div>

      <div className="relative pt-12">
        <div className="h-36 bg-gradient-to-br from-primary/30 to-primary/10" />
        <div className="absolute -bottom-12 left-4 rounded-full border-4 border-card">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full bg-muted object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">{initial}</div>
          )}
        </div>
      </div>

      <div className="mt-14 px-4">
        {editing ? (
          <div className="space-y-2">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="Name" />
            <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="Bio" rows={2} />
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground">Save</button>
              <button onClick={() => setEditing(false)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground">{profile?.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile?.bio || "No bio yet"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{friendCount} friends</p>
            <div className="mt-3 flex gap-2">
              {isOwnProfile ? (
                <button onClick={() => setEditing(true)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">Edit Profile</button>
              ) : (
                <button onClick={handleSendRequest} disabled={friendStatus !== "none"} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${friendStatus === "friends" ? "bg-secondary text-foreground" : friendStatus === "none" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {friendStatus === "friends" && <><UserCheck size={16} /> Friends</>}
                  {friendStatus === "sent" && "Request Sent"}
                  {friendStatus === "received" && "Accept Request"}
                  {friendStatus === "none" && <><UserPlus size={16} /> Add Friend</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-border">
        <h3 className="px-4 py-3 text-sm font-semibold text-foreground">Posts</h3>
        {posts.length > 0 ? (
          <div className="space-y-2 bg-muted">
            {posts.map((post) => <PostCard key={post.id} post={post} onLike={handleLike} onComment={handleComment} currentUserId={user?.id} />)}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No posts yet</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
