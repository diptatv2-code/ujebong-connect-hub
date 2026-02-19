import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PostWithProfile {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: { name: string; avatar_url: string } | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

const FeedsPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    if (!user) return;
    const { data: rawPosts } = await supabase
      .from("posts")
      .select("id, user_id, content, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawPosts) { setLoading(false); return; }

    // Get profiles for post authors
    const userIds = [...new Set(rawPosts.map((p) => p.user_id))];
    const { data: profilesData } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
    const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));

    // Get like counts + my likes
    const postIds = rawPosts.map((p) => p.id);
    const { data: likes } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
    const { data: comments } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

    const enriched: PostWithProfile[] = rawPosts.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
      ...p,
      profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null,
      like_count: likes?.filter((l) => l.post_id === p.id).length ?? 0,
      comment_count: comments?.filter((c) => c.post_id === p.id).length ?? 0,
      liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === user.id) ?? false,
    };
    });

    setPosts(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [user]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLike = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
  };

  const handlePost = async (content: string, imageUrl?: string) => {
    if (!user) return;
    await supabase.from("posts").insert({ user_id: user.id, content, image_url: imageUrl || null });
  };

  const handleComment = async (postId: string, content: string) => {
    if (!user) return;
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content });
    fetchPosts();
  };

  return (
    <div className="pb-16 pt-14">
      {/* Create post prompt */}
      <div className="flex cursor-pointer items-center gap-3 border-b border-border bg-card px-4 py-3" onClick={() => setShowCreate(true)}>
        <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
          {user?.user_metadata?.name?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
          What's on your mind?
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-2 bg-muted pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No posts yet. Be the first to share!</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} onComment={handleComment} currentUserId={user?.id} />
          ))
        )}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} className="text-primary-foreground" />
      </motion.button>

      <CreatePostDialog open={showCreate} onClose={() => setShowCreate(false)} onPost={handlePost} userName={user?.user_metadata?.name || "You"} />
    </div>
  );
};

export default FeedsPage;
