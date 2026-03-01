import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, RefreshCw, Download, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

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
  my_reaction: string | null;
  reaction_counts: Record<string, number>;
}

const FeedSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-card border-b border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-2 w-16 rounded" />
          </div>
        </div>
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
        {i === 0 && <Skeleton className="h-48 w-full rounded-lg" />}
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const FeedsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);

    const { data: rawPosts } = await supabase
      .from("posts")
      .select("id, user_id, content, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawPosts) { setLoading(false); setRefreshing(false); return; }

    const userIds = [...new Set(rawPosts.map((p) => p.user_id))];
    const postIds = rawPosts.map((p) => p.id);
    
    const [{ data: profilesData }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_url").in("id", userIds),
      supabase.from("post_likes").select("post_id, user_id, reaction_type").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
    ]);

    const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));

    const enriched: PostWithProfile[] = rawPosts.map((p) => {
      const prof = profileMap.get(p.user_id);
      const postLikes = likes?.filter((l) => l.post_id === p.id) ?? [];
      const myLike = postLikes.find((l) => l.user_id === user.id);
      const reactionCounts: Record<string, number> = {};
      postLikes.forEach((l) => {
        const r = l.reaction_type || "like";
        reactionCounts[r] = (reactionCounts[r] || 0) + 1;
      });
      return {
        ...p,
        profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null,
        like_count: postLikes.length,
        comment_count: comments?.filter((c) => c.post_id === p.id).length ?? 0,
        liked_by_me: !!myLike,
        my_reaction: myLike?.reaction_type || null,
        reaction_counts: reactionCounts,
      };
    });

    setPosts(enriched);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  // Pull to refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 150) {
      setPullDistance(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !refreshing) {
      fetchPosts(true);
    }
    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, refreshing, fetchPosts]);

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
  };

  const handlePost = async (content: string, imageUrl?: string) => {
    if (!user) return;
    const trimmed = content.trim().slice(0, 5000);
    if (!trimmed && !imageUrl) return;
    await supabase.from("posts").insert({ user_id: user.id, content: trimmed, image_url: imageUrl || null });
  };

  const handleComment = async (postId: string, content: string) => {
    if (!user) return;
    const trimmed = content.trim().slice(0, 2000);
    if (!trimmed) return;
    await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content: trimmed });
    fetchPosts();
  };

  return (
    <div
      ref={containerRef}
      className="pb-16 pt-header min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div className="flex items-center justify-center py-3 bg-card" style={{ height: refreshing ? 48 : pullDistance * 0.5 }}>
          <RefreshCw size={18} className={`text-primary transition-transform ${refreshing ? "animate-spin" : pullDistance > 60 ? "rotate-180" : ""}`} />
          {!refreshing && <span className="ml-2 text-xs text-muted-foreground">{pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}</span>}
        </div>
      )}

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
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No posts yet. Be the first to share!</p>
        ) : (
          <>
            {(showAll ? posts : posts.slice(0, 10)).map((post) => (
              <PostCard key={post.id} post={post} onReaction={handleReaction} onComment={handleComment} onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))} currentUserId={user?.id} />
            ))}

            {/* See More / Bottom Actions */}
            {!showAll && posts.length > 10 ? (
              <div className="bg-card px-4 py-4">
                <button
                  onClick={() => setShowAll(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                >
                  See More ({posts.length - 10} more posts)
                </button>
              </div>
            ) : null}

            {/* Download & Logout always visible after posts */}
            <div className="bg-card border-t border-border px-4 py-6 space-y-3">
              <button
                onClick={() => navigate("/install")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                <Download size={18} /> Download the App
              </button>
              <button
                onClick={async () => { await signOut(); navigate("/login"); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-foreground"
              >
                <LogOut size={18} /> Log Out
              </button>
            </div>
          </>
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
