import { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Send, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { PostWithProfile } from "@/pages/FeedsPage";
import { formatDistanceToNow } from "date-fns";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😡", label: "Angry" },
];

interface PostCardProps {
  post: PostWithProfile;
  onReaction: (id: string, reactionType: string) => void;
  onComment: (postId: string, content: string) => void;
  currentUserId?: string;
}

interface CommentWithProfile {
  id: string;
  content: string;
  audio_url: string | null;
  created_at: string;
  profiles: { name: string; avatar_url: string } | null;
}

const PostCard = ({ post, onReaction, onComment, currentUserId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const reactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const { user } = useAuth();

  const fetchComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, content, audio_url, created_at, user_id")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setComments(data.map(c => {
        const prof = profileMap.get(c.user_id);
        return { ...c, audio_url: c.audio_url || null, profiles: prof ? { name: prof.name, avatar_url: prof.avatar_url } : null };
      }));
    }
  };

  useEffect(() => {
    if (showComments) fetchComments();
  }, [showComments]);

  const handleSendComment = () => {
    if (commentText.trim()) {
      onComment(post.id, commentText.trim());
      setCommentText("");
      setTimeout(fetchComments, 500);
    }
  };

  const handleVoiceComment = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}.webm`;
    const { error: uploadErr } = await supabase.storage.from("voice-notes").upload(path, file);
    if (uploadErr) {
      toast({ title: "Voice upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: "",
      audio_url: path,
    });
    if (!error) setTimeout(fetchComments, 500);
  };

  const handleLongPressStart = () => {
    reactionTimeout.current = setTimeout(() => setShowReactions(true), 500);
  };

  const handleLongPressEnd = () => {
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
  };

  const handleQuickTap = () => {
    if (showReactions) return;
    onReaction(post.id, "like");
  };

  const currentReaction = REACTIONS.find(r => r.type === post.my_reaction);
  const avatarInitial = post.profiles?.name?.[0]?.toUpperCase() || "U";

  // Build reaction summary text
  const reactionSummary = Object.entries(post.reaction_counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const r = REACTIONS.find(r => r.type === type);
      return r ? r.emoji : "";
    })
    .join("");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate(`/profile/${post.user_id}`)}>
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{avatarInitial}</div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{post.profiles?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        <button className="text-muted-foreground"><MoreHorizontal size={20} /></button>
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
          <span>{post.comment_count} comments</span>
        </div>
      )}

      {/* Reaction picker */}
      <AnimatePresence>
        {showReactions && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            className="flex items-center gap-1 px-4 py-2 justify-center"
          >
            <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-lg px-2 py-1">
              {REACTIONS.map((r) => (
                <motion.button
                  key={r.type}
                  whileHover={{ scale: 1.4, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    onReaction(post.id, r.type);
                    setShowReactions(false);
                  }}
                  className="text-xl px-1 py-0.5 transition-transform"
                  title={r.label}
                >
                  {r.emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex border-t border-border">
        <button
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          onClick={handleQuickTap}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
        >
          {currentReaction ? (
            <>
              <span className="text-lg">{currentReaction.emoji}</span>
              <span className="text-primary">{currentReaction.label}</span>
            </>
          ) : (
            <>
              <ThumbsUp size={18} className="text-muted-foreground" />
              <span className="text-muted-foreground">Like</span>
            </>
          )}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <MessageCircle size={18} />
          Comment
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <Share2 size={18} />
          Share
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
            <div className="space-y-3 px-4 py-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt="" className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-muted" />
                  ) : (
                    <div className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {comment.profiles?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="rounded-2xl bg-secondary px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{comment.profiles?.name || "User"}</p>
                    {comment.audio_url && <AudioPlayer path={comment.audio_url} />}
                    {comment.content && <p className="text-xs text-foreground">{comment.content}</p>}
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground">No comments yet</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2">
              <VoiceRecorder onRecordingComplete={handleVoiceComment} compact />
              <div className="flex flex-1 items-center rounded-full bg-secondary px-3 py-1.5">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button onClick={handleSendComment} className="text-primary"><Send size={14} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
