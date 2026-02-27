import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, UserCheck, Camera, LogOut, MessageCircle, UserX, Ban, BadgeCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/PostCard";
import type { PostWithProfile } from "@/pages/FeedsPage";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { formatDistanceToNow } from "date-fns";

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isOwnProfile = userId === user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [friendStatus, setFriendStatus] = useState<"none" | "friends" | "sent" | "received">("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!userId || !user) return;

      const [{ data: prof }, { data: rawPosts }, { data: friendships }, { data: blocks }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("posts").select("id, user_id, content, image_url, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("friendships").select("*").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
        supabase.from("blocked_users").select("id").eq("blocker_id", user.id).eq("blocked_id", userId),
      ]);
      setIsBlocked((blocks?.length ?? 0) > 0);

      setProfile(prof);
      setEditName(prof?.name || "");
      setEditBio(prof?.bio || "");
      setEditEmail(user?.email || "");

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
          supabase.from("post_likes").select("post_id, user_id, reaction_type").in("post_id", postIds),
          supabase.from("post_comments").select("post_id").in("post_id", postIds),
        ]);
        setPosts(rawPosts.map((p: any) => {
          const postLikes = likes?.filter((l: any) => l.post_id === p.id) ?? [];
          const myLike = postLikes.find((l: any) => l.user_id === user.id);
          const reactionCounts: Record<string, number> = {};
          postLikes.forEach((l: any) => { const r = l.reaction_type || "like"; reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
          return {
            ...p,
            profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null,
            like_count: postLikes.length,
            comment_count: comments?.filter((c: any) => c.post_id === p.id).length ?? 0,
            liked_by_me: !!myLike,
            my_reaction: myLike?.reaction_type || null,
            reaction_counts: reactionCounts,
          };
        }));
      }
      setLoading(false);
    };
    fetch();
  }, [userId, user]);

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.my_reaction === reactionType) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else if (post.liked_by_me) {
      await supabase.from("post_likes").update({ reaction_type: reactionType }).eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id, reaction_type: reactionType });
    }
    // Refresh
    const { data: likes } = await supabase.from("post_likes").select("post_id, user_id, reaction_type").in("post_id", posts.map(p => p.id));
    setPosts(prev => prev.map(p => {
      const postLikes = likes?.filter(l => l.post_id === p.id) ?? [];
      const myLike = postLikes.find(l => l.user_id === user.id);
      const reactionCounts: Record<string, number> = {};
      postLikes.forEach(l => { const r = l.reaction_type || "like"; reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
      return {
        ...p,
        like_count: postLikes.length,
        liked_by_me: !!myLike,
        my_reaction: myLike?.reaction_type || null,
        reaction_counts: reactionCounts,
      };
    }));
  };

  const handleComment = async (postId: string, content: string) => {
    if (!user) return;
    const trimmed = content.trim().slice(0, 2000);
    if (!trimmed) return;
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content: trimmed });
  };

  const handleSendRequest = async () => {
    if (!user || !userId) return;
    await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: userId });
    setFriendStatus("sent");
    toast.success("Friend request sent!");
  };

  const handleAcceptRequest = async () => {
    if (!user || !friendshipId) return;
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    if (error) {
      toast.error("Failed to accept request");
      return;
    }
    setFriendStatus("friends");
    toast.success("Friend request accepted!");
  };

  const handleUnfriend = async () => {
    if (!friendshipId) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    setFriendStatus("none");
    setFriendshipId(null);
    toast.success("Unfriended");
  };

  const handleToggleBlock = async () => {
    if (!user || !userId) return;
    if (isBlocked) {
      await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
      setIsBlocked(false);
      toast.success("User unblocked");
    } else {
      await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: userId });
      setIsBlocked(true);
      // Also unfriend
      if (friendshipId) {
        await supabase.from("friendships").delete().eq("id", friendshipId);
        setFriendStatus("none");
        setFriendshipId(null);
      }
      toast.success("User blocked");
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const safeName = editName.trim().slice(0, 100);
    const safeBio = editBio.trim().slice(0, 500);
    if (!safeName) { toast.error("Name cannot be empty"); return; }
    await supabase.from("profiles").update({ name: safeName, bio: safeBio }).eq("id", user.id);
    setProfile((p: any) => ({ ...p, name: safeName, bio: safeBio }));
    setEditing(false);
    toast.success("Profile updated!");
  };

  const handleChangeEmail = async () => {
    if (!user) return;
    const newEmail = editEmail.trim();
    if (!newEmail || newEmail === user.email) return;
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Confirmation email sent to your new address. Please check your inbox.");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const avatarUrl = await uploadToCloudinary(file, "ujebong/avatars", { maxWidth: 400, quality: 0.7 });
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
      setProfile((p: any) => ({ ...p, avatar_url: avatarUrl }));
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error("Upload failed");
    }
    setUploading(false);
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
        <div className="absolute -bottom-12 left-4 rounded-full border-4 border-card relative">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full bg-muted object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">{initial}</div>
          )}
          {isOwnProfile && (
            <>
              <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarUpload} className="hidden" />
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-card"
              >
                <Camera size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-14 px-4">
        {editing ? (
          <div className="space-y-2">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="Name" />
            <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="Bio" rows={2} />
            <div className="flex items-center gap-2">
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="Email" type="email" />
              <button onClick={handleChangeEmail} disabled={emailSaving || editEmail.trim() === user?.email} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
                {emailSaving ? "..." : "Change"}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground">Save</button>
              <button onClick={() => setEditing(false)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{profile?.name}</h1>
              {profile?.is_verified && <BadgeCheck size={18} className="text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{profile?.bio || "No bio yet"}</p>
            {isOwnProfile && <p className="mt-1 text-xs text-muted-foreground">✉️ {user?.email}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{friendCount} friends</p>
            {profile?.last_active_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {(() => {
                  const diff = Date.now() - new Date(profile.last_active_at).getTime();
                  if (diff < 2 * 60 * 1000) return "🟢 Active now";
                  return `Last seen ${formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: true })}`;
                })()}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {isOwnProfile ? (
                <button onClick={() => setEditing(true)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">Edit Profile</button>
              ) : (
                <>
                  {friendStatus === "friends" ? (
                    <button onClick={handleUnfriend} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">
                      <UserX size={16} /> Unfriend
                    </button>
                  ) : (
                    <button
                      onClick={friendStatus === "received" ? handleAcceptRequest : handleSendRequest}
                      disabled={friendStatus === "sent"}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${
                        friendStatus === "received" ? "bg-primary text-primary-foreground"
                        : friendStatus === "none" ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                      }`}
                    >
                      {friendStatus === "sent" && "Request Sent"}
                      {friendStatus === "received" && "Accept Request"}
                      {friendStatus === "none" && <><UserPlus size={16} /> Add Friend</>}
                    </button>
                  )}
                  <button onClick={() => navigate(`/chat/${userId}`)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">
                    <MessageCircle size={16} /> Message
                  </button>
                  <button onClick={handleToggleBlock} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${isBlocked ? "bg-destructive text-destructive-foreground" : "bg-secondary text-muted-foreground"}`}>
                    <Ban size={16} /> {isBlocked ? "Unblock" : "Block"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-border">
        <h3 className="px-4 py-3 text-sm font-semibold text-foreground">Posts</h3>
        {posts.length > 0 ? (
          <div className="space-y-2 bg-muted">
            {posts.map((post) => <PostCard key={post.id} post={post} onReaction={handleReaction} onComment={handleComment} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} currentUserId={user?.id} />)}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No posts yet</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
