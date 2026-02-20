import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Lock, Globe, X, Plus, Image, Loader2, Pin, Send, ThumbsUp, MessageCircle, MoreHorizontal, Trash2, Share2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import AudioPlayer from "@/components/AudioPlayer";
import VoiceRecorder from "@/components/VoiceRecorder";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string;
  avatar_url: string | null;
}

interface GroupPost {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  profiles: { name: string; avatar_url: string | null } | null;
  like_count: number;
  comment_count: number;
  my_reaction: string | null;
  reaction_counts: Record<string, number>;
}

interface GroupComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { name: string; avatar_url: string | null } | null;
}

interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  name: string;
  avatar_url: string | null;
}

type Tab = "posts" | "members" | "about" | "requests";

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostPreview, setNewPostPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingRequest, setPendingRequest] = useState(false);

  // Fetch group + membership
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

    if (memberships && memberships.length > 0) {
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setMembers(memberships.map(m => {
        const p = profileMap.get(m.user_id);
        return { ...m, name: p?.name || "User", avatar_url: p?.avatar_url || null };
      }));
    } else {
      setMembers([]);
    }

    // Check pending join request for private groups
    if (g && !g.is_public && !myMembership) {
      const { data: req } = await supabase
        .from("group_join_requests")
        .select("id, status")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      setPendingRequest(!!req);
    }

    setLoading(false);
  };

  // Fetch group posts
  const fetchPosts = async () => {
    if (!groupId || !user) return;
    setPostsLoading(true);
    const { data: rawPosts } = await supabase
      .from("group_posts")
      .select("id, group_id, user_id, content, image_url, is_pinned, created_at")
      .eq("group_id", groupId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawPosts) { setPostsLoading(false); return; }

    const userIds = [...new Set(rawPosts.map(p => p.user_id))];
    const postIds = rawPosts.map(p => p.id);

    const [{ data: profiles }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url").in("id", userIds.length ? userIds : ["_"]),
      supabase.from("group_post_likes").select("post_id, user_id, reaction_type").in("post_id", postIds.length ? postIds : ["_"]),
      supabase.from("group_post_comments").select("post_id").in("post_id", postIds.length ? postIds : ["_"]),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const enriched: GroupPost[] = rawPosts.map(p => {
      const prof = profileMap.get(p.user_id);
      const postLikes = likes?.filter(l => l.post_id === p.id) ?? [];
      const myLike = postLikes.find(l => l.user_id === user.id);
      const reactionCounts: Record<string, number> = {};
      postLikes.forEach(l => {
        const r = l.reaction_type || "like";
        reactionCounts[r] = (reactionCounts[r] || 0) + 1;
      });
      return {
        ...p,
        profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null,
        like_count: postLikes.length,
        comment_count: comments?.filter(c => c.post_id === p.id).length ?? 0,
        my_reaction: myLike?.reaction_type || null,
        reaction_counts: reactionCounts,
      };
    });

    setPosts(enriched);
    setPostsLoading(false);
  };

  // Fetch join requests (admin only)
  const fetchJoinRequests = async () => {
    if (!groupId || !isGroupAdmin) return;
    const { data } = await supabase
      .from("group_join_requests")
      .select("id, user_id, status, created_at")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      const uids = data.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", uids);
      const pm = new Map((profiles || []).map(p => [p.id, p]));
      setJoinRequests(data.map(r => {
        const p = pm.get(r.user_id);
        return { ...r, name: p?.name || "User", avatar_url: p?.avatar_url || null };
      }));
    } else {
      setJoinRequests([]);
    }
  };

  useEffect(() => { fetchGroup(); }, [groupId, user]);
  useEffect(() => { if (joined) fetchPosts(); }, [joined, groupId]);
  useEffect(() => { if (isGroupAdmin && activeTab === "requests") fetchJoinRequests(); }, [isGroupAdmin, activeTab]);

  // Join / Leave / Request
  const handleToggleJoin = async () => {
    if (!user || !groupId) return;
    if (joined) {
      await supabase.from("group_memberships").delete().eq("group_id", groupId).eq("user_id", user.id);
      setJoined(false);
      toast.success("Left group");
      fetchGroup();
    } else if (group?.is_public) {
      await supabase.from("group_memberships").insert({ group_id: groupId, user_id: user.id });
      setJoined(true);
      toast.success("Joined group!");
      fetchGroup();
    } else {
      // Request to join private group
      await supabase.from("group_join_requests").insert({ group_id: groupId, user_id: user.id });
      setPendingRequest(true);
      toast.success("Join request sent!");
    }
  };

  // Approve / Reject join request
  const handleApproveRequest = async (requestId: string, requestUserId: string) => {
    if (!groupId) return;
    await supabase.from("group_join_requests").update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", requestId);
    await supabase.from("group_memberships").insert({ group_id: groupId, user_id: requestUserId });
    toast.success("Member approved!");
    fetchJoinRequests();
    fetchGroup();
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase.from("group_join_requests").update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", requestId);
    toast.success("Request rejected");
    fetchJoinRequests();
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (!isGroupAdmin || memberUserId === user?.id) return;
    await supabase.from("group_memberships").delete().eq("id", memberId);
    toast.success("Member removed");
    fetchGroup();
  };

  // Create post
  const handleCreatePost = async () => {
    if (!user || !groupId || (!newPostContent.trim() && !newPostImage)) return;
    setPosting(true);

    let imageUrl: string | undefined;
    if (newPostImage) {
      const ext = newPostImage.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("group-posts").upload(path, newPostImage);
      if (!error) {
        const { data } = supabase.storage.from("group-posts").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
    }

    await supabase.from("group_posts").insert({
      group_id: groupId,
      user_id: user.id,
      content: newPostContent.trim().slice(0, 5000),
      image_url: imageUrl || null,
    });

    setNewPostContent("");
    setNewPostImage(null);
    setNewPostPreview(null);
    setPosting(false);
    setShowCreatePost(false);
    fetchPosts();
  };

  // Reaction
  const handleReaction = async (postId: string, reactionType: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.my_reaction === reactionType) {
      await supabase.from("group_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else if (post.my_reaction) {
      await supabase.from("group_post_likes").update({ reaction_type: reactionType }).eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("group_post_likes").insert({ post_id: postId, user_id: user.id, reaction_type: reactionType });
    }
    fetchPosts();
  };

  // Comment
  const handleComment = async (postId: string, content: string) => {
    if (!user) return;
    await supabase.from("group_post_comments").insert({ post_id: postId, user_id: user.id, content: content.trim().slice(0, 2000) });
    fetchPosts();
  };

  // Pin/Unpin
  const handleTogglePin = async (postId: string, currentlyPinned: boolean) => {
    await supabase.from("group_posts").update({ is_pinned: !currentlyPinned }).eq("id", postId);
    toast.success(currentlyPinned ? "Post unpinned" : "Post pinned");
    fetchPosts();
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    await supabase.from("group_post_likes").delete().eq("post_id", postId);
    await supabase.from("group_post_comments").delete().eq("post_id", postId);
    await supabase.from("group_posts").delete().eq("id", postId);
    toast.success("Post deleted");
    fetchPosts();
  };

  if (loading) return <div className="flex items-center justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!group) return <div className="pt-20 text-center text-muted-foreground">Group not found</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "members", label: `Members (${members.length})` },
    { key: "about", label: "About" },
    ...(isGroupAdmin && !group.is_public ? [{ key: "requests" as Tab, label: `Requests (${joinRequests.length})` }] : []),
  ];

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={22} className="text-foreground" /></button>
        <h2 className="flex-1 truncate text-base font-semibold text-foreground">{group.name}</h2>
      </div>

      {/* Cover */}
      <div className="pt-12">
        {group.cover_photo_url ? (
          <div className="h-40 overflow-hidden bg-muted"><img src={group.cover_photo_url} alt="" className="h-full w-full object-cover" /></div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-primary/30 to-primary/10" />
        )}
      </div>

      {/* Group info */}
      <div className="bg-card px-4 py-4">
        <h1 className="text-lg font-bold text-foreground">{group.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {group.is_public ? <Globe size={12} /> : <Lock size={12} />}
          <span>{group.is_public ? "Public Group" : "Private Group"}</span>
          <span>·</span>
          <Users size={12} />
          <span>{members.length} members</span>
        </div>
        {group.description && <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>}

        {pendingRequest && !joined ? (
          <div className="mt-3 w-full rounded-lg py-2.5 text-center text-sm font-medium bg-secondary text-muted-foreground">
            Request Pending
          </div>
        ) : (
          <button onClick={handleToggleJoin} className={`mt-3 w-full rounded-lg py-2.5 text-sm font-medium ${joined ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"}`}>
            {joined ? "Leave Group" : (group.is_public ? "Join Group" : "Request to Join")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${activeTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "posts" && (
        <div className="bg-muted">
          {/* Create post prompt (only for members) */}
          {joined && (
            <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setShowCreatePost(true)}>
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {user?.user_metadata?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
                Write something...
              </div>
            </div>
          )}

          {/* Create post dialog */}
          <AnimatePresence>
            {showCreatePost && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40" onClick={() => setShowCreatePost(false)}>
                <motion.div
                  initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="w-full max-w-lg rounded-t-2xl bg-card" onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <button onClick={() => setShowCreatePost(false)}><X size={22} className="text-foreground" /></button>
                    <h2 className="text-base font-semibold text-foreground">Post in {group.name}</h2>
                    <button onClick={handleCreatePost} disabled={(!newPostContent.trim() && !newPostImage) || posting} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 flex items-center gap-1">
                      {posting && <Loader2 size={12} className="animate-spin" />} Post
                    </button>
                  </div>
                  <textarea placeholder="What's on your mind?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)}
                    className="min-h-[120px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
                  {newPostPreview && (
                    <div className="relative mx-4 mb-3">
                      <img src={newPostPreview} alt="Preview" className="w-full rounded-xl object-cover max-h-60" />
                      <button onClick={() => { setNewPostImage(null); setNewPostPreview(null); }} className="absolute top-2 right-2 rounded-full bg-foreground/60 p-1 text-background"><X size={16} /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-4 border-t border-border px-4 py-3">
                    <input type="file" accept="image/*" ref={fileRef} onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setNewPostImage(f); setNewPostPreview(URL.createObjectURL(f)); }
                    }} className="hidden" />
                    <button onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary"><Image size={22} /></button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Posts feed */}
          <div className="space-y-2 pt-2">
            {postsLoading ? (
              <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : !joined ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                {group.is_public ? "Join to see posts and interact" : "This is a private group. Request to join to see posts."}
              </p>
            ) : posts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No posts yet. Be the first to share!</p>
            ) : (
              posts.map(post => (
                <GroupPostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  isGroupAdmin={isGroupAdmin}
                  onReaction={handleReaction}
                  onComment={handleComment}
                  onDelete={handleDeletePost}
                  onTogglePin={handleTogglePin}
                  navigate={navigate}
                />
              ))
            )}
          </div>

          {/* FAB */}
          {joined && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreatePost(true)}
              className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
              <Plus size={24} className="text-primary-foreground" />
            </motion.button>
          )}
        </div>
      )}

      {activeTab === "members" && (
        <div className="bg-card px-4 py-3">
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${m.user_id}`)}>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">{m.name[0]?.toUpperCase()}</div>
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
      )}

      {activeTab === "about" && (
        <div className="bg-card px-4 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Type</p>
            <p className="text-sm text-foreground flex items-center gap-1 mt-1">
              {group.is_public ? <><Globe size={14} /> Public Group</> : <><Lock size={14} /> Private Group</>}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Description</p>
            <p className="text-sm text-foreground mt-1">{group.description || "No description"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Members</p>
            <p className="text-sm text-foreground mt-1">{members.length} members</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Created</p>
            <p className="text-sm text-foreground mt-1">{new Date(group.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {activeTab === "requests" && isGroupAdmin && (
        <div className="bg-card px-4 py-3">
          {joinRequests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {joinRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {req.avatar_url ? (
                      <img src={req.avatar_url} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">{req.name[0]?.toUpperCase()}</div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveRequest(req.id, req.user_id)} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Approve</button>
                    <button onClick={() => handleRejectRequest(req.id)} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============= Group Post Card Component =============
interface GroupPostCardProps {
  post: GroupPost;
  currentUserId?: string;
  isGroupAdmin: boolean;
  onReaction: (postId: string, reactionType: string) => void;
  onComment: (postId: string, content: string) => void;
  onDelete: (postId: string) => void;
  onTogglePin: (postId: string, currentlyPinned: boolean) => void;
  navigate: (path: string) => void;
}

const GroupPostCard = ({ post, currentUserId, isGroupAdmin, onReaction, onComment, onDelete, onTogglePin, navigate }: GroupPostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<GroupComment[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const reactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const isOwner = currentUserId === post.user_id;
  const canDelete = isOwner || isGroupAdmin;

  const fetchComments = async () => {
    const { data } = await supabase
      .from("group_post_comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (data) {
      const uids = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", uids.length ? uids : ["_"]);
      const pm = new Map((profiles || []).map(p => [p.id, p]));
      setComments(data.map(c => ({
        ...c,
        profiles: pm.get(c.user_id) ? { name: pm.get(c.user_id)!.name, avatar_url: pm.get(c.user_id)!.avatar_url } : null,
      })));
    }
  };

  useEffect(() => { if (showComments) fetchComments(); }, [showComments]);

  const handleSendComment = () => {
    if (commentText.trim()) {
      onComment(post.id, commentText.trim());
      setCommentText("");
      setTimeout(fetchComments, 500);
    }
  };

  const handleLongPressStart = () => { reactionTimeout.current = setTimeout(() => setShowReactions(true), 500); };
  const handleLongPressEnd = () => { if (reactionTimeout.current) clearTimeout(reactionTimeout.current); };
  const handleQuickTap = () => { if (!showReactions) onReaction(post.id, "like"); };

  const currentReaction = REACTIONS.find(r => r.type === post.my_reaction);
  const reactionSummary = Object.entries(post.reaction_counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => REACTIONS.find(r => r.type === type)?.emoji || "")
    .join("");

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("group_post_comments").delete().eq("id", commentId);
    fetchComments();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border bg-card">
      {post.is_pinned && (
        <div className="flex items-center gap-1 px-4 pt-2 text-[10px] text-primary font-medium">
          <Pin size={10} /> Pinned Post
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${post.user_id}`)}>
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {post.profiles?.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{post.profiles?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        <div className="relative">
          <button className="text-muted-foreground" onClick={() => setShowMenu(!showMenu)}><MoreHorizontal size={20} /></button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
              {isGroupAdmin && (
                <button onClick={() => { onTogglePin(post.id, post.is_pinned); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted">
                  <Pin size={14} /> {post.is_pinned ? "Unpin" : "Pin Post"}
                </button>
              )}
              {canDelete && (
                <button onClick={() => { onDelete(post.id); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted">
                  <Trash2 size={14} /> Delete Post
                </button>
              )}
              <button onClick={() => setShowMenu(false)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            </div>
          )}
        </div>
      </div>

      <p className="px-4 pb-2 text-sm leading-relaxed text-foreground">{post.content}</p>

      {post.image_url && (
        <div className="aspect-[3/2] w-full overflow-hidden bg-muted">
          <img src={post.image_url} alt="Post" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      {(post.like_count > 0 || post.comment_count > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
          <span>{reactionSummary} {post.like_count}</span>
          <button onClick={() => setShowComments(!showComments)} className="hover:underline">{post.comment_count} comments</button>
        </div>
      )}

      {/* Reaction picker */}
      <AnimatePresence>
        {showReactions && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.8 }} className="flex items-center gap-1 px-4 py-2 justify-center">
            <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-lg px-2 py-1">
              {REACTIONS.map(r => (
                <motion.button key={r.type} whileHover={{ scale: 1.4, y: -4 }} whileTap={{ scale: 0.9 }}
                  onClick={() => { onReaction(post.id, r.type); setShowReactions(false); }}
                  className="text-xl px-1 py-0.5" title={r.label}>{r.emoji}</motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex border-t border-border">
        <button onMouseDown={handleLongPressStart} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart} onTouchEnd={handleLongPressEnd} onClick={handleQuickTap}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium">
          {currentReaction ? (
            <><span className="text-lg">{currentReaction.emoji}</span><span className="text-primary">{currentReaction.label}</span></>
          ) : (
            <><ThumbsUp size={18} className="text-muted-foreground" /><span className="text-muted-foreground">Like</span></>
          )}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <MessageCircle size={18} /> Comment
        </button>
        <button onClick={() => {
          const url = `${window.location.origin}/group/${post.group_id}`;
          if (navigator.share) { navigator.share({ title: "Group Post", text: post.content?.slice(0, 100), url }).catch(() => {}); }
          else { navigator.clipboard.writeText(url); toast.success("Link copied!"); }
        }} className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <Share2 size={18} /> Share
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
            <div className="space-y-3 px-4 py-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  {c.profiles?.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-muted" />
                  ) : (
                    <div className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {c.profiles?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="flex-1 flex items-start gap-1">
                    <div className="flex-1 rounded-2xl bg-secondary px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{c.profiles?.name || "User"}</p>
                      <p className="text-xs text-foreground">{c.content}</p>
                    </div>
                    {(c.user_id === currentUserId || isGroupAdmin) && (
                      <button onClick={() => handleDeleteComment(c.id)} className="mt-1 text-muted-foreground p-1 hover:text-destructive">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground">No comments yet</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2">
              <div className="flex flex-1 items-center rounded-full bg-secondary px-3 py-1.5">
                <input type="text" placeholder="Write a comment..." value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendComment()}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                <button onClick={handleSendComment} className="text-primary"><Send size={14} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GroupPage;
