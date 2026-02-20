import { useState, useEffect, useRef } from "react";
import { MessageCircle, Share2, MoreHorizontal, Send, ThumbsUp, Trash2, Flag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApproval } from "@/hooks/useApproval";
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
  onDelete?: (postId: string) => void;
  currentUserId?: string;
}

interface CommentWithProfile {
  id: string;
  content: string;
  audio_url: string | null;
  created_at: string;
  user_id: string;
  profiles: { name: string; avatar_url: string } | null;
}

const CommentItem = ({ comment, currentUserId, isAdmin, onDelete, onReport }: {
  comment: CommentWithProfile;
  currentUserId?: string;
  isAdmin: boolean;
  onDelete: (id: string, userId: string) => void;
  onReport: (id: string, userId: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = comment.user_id === currentUserId;
  const canDelete = isOwner || isAdmin;
  const canReport = !isOwner;

  return (
    <div className="flex gap-2">
      {comment.profiles?.avatar_url ? (
        <img src={comment.profiles.avatar_url} alt="" className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-muted" />
      ) : (
        <div className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
          {comment.profiles?.name?.[0]?.toUpperCase() || "U"}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-start gap-1">
          <div className="flex-1 rounded-2xl bg-secondary px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{comment.profiles?.name || "User"}</p>
            {comment.audio_url && <AudioPlayer path={comment.audio_url} />}
            {comment.content && <p className="text-xs text-foreground">{comment.content}</p>}
          </div>
          {(canDelete || canReport) && (
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="mt-1 text-muted-foreground p-1">
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-50 w-36 rounded-lg border border-border bg-card shadow-lg py-1">
                  {canDelete && (
                    <button onClick={() => { onDelete(comment.id, comment.user_id); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted">
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                  {canReport && (
                    <button onClick={() => { onReport(comment.id, comment.user_id); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted">
                      <Flag size={12} /> Report
                    </button>
                  )}
                  <button onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PostCard = ({ post, onReaction, onComment, onDelete, currentUserId }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const reactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useApproval();

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const isOwner = currentUserId === post.user_id;
  const canDelete = isOwner || isAdmin;

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
      post_id: post.id, user_id: user.id, content: "", audio_url: path,
    });
    if (!error) setTimeout(fetchComments, 500);
  };

  const handleDeletePost = async () => {
    if (!canDelete) return;
    await supabase.from("post_likes").delete().eq("post_id", post.id);
    await supabase.from("post_comments").delete().eq("post_id", post.id);
    await supabase.from("posts").delete().eq("id", post.id);
    onDelete?.(post.id);
    setShowMenu(false);
    toast({ title: "Post deleted" });
  };

  const handleDeleteComment = async (commentId: string, commentUserId: string) => {
    if (commentUserId !== currentUserId && !isAdmin) return;
    await supabase.from("post_comments").delete().eq("id", commentId);
    fetchComments();
    toast({ title: "Comment deleted" });
  };

  const handleReportPost = async () => {
    if (!user) return;
    await supabase.from("reports").insert({
      reporter_id: user.id, post_id: post.id, reported_user_id: post.user_id,
      reason: reportReason.trim() || "No reason provided",
    });
    setShowReportDialog(false);
    setReportReason("");
    setShowMenu(false);
    toast({ title: "Post reported", description: "Admin will review this content." });
  };

  const handleReportComment = async (commentId: string, commentUserId: string) => {
    if (!user) return;
    await supabase.from("reports").insert({
      reporter_id: user.id, comment_id: commentId, reported_user_id: commentUserId,
      reason: "Reported comment",
    });
    toast({ title: "Comment reported" });
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

  const reactionSummary = Object.entries(post.reaction_counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => {
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
        <div className="relative">
          <button className="text-muted-foreground" onClick={() => setShowMenu(!showMenu)}><MoreHorizontal size={20} /></button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
              {canDelete && (
                <button onClick={handleDeletePost} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted">
                  <Trash2 size={14} /> Delete Post
                </button>
              )}
              {!isOwner && (
                <button onClick={() => { setShowReportDialog(true); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted">
                  <Flag size={14} /> Report Post
                </button>
              )}
              <button onClick={() => setShowMenu(false)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="mx-4 mb-2 rounded-lg border border-border bg-secondary p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Report this post</p>
          <input value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded bg-card border border-border px-2 py-1 text-xs text-foreground outline-none" />
          <div className="flex gap-2">
            <button onClick={handleReportPost} className="rounded bg-destructive px-3 py-1 text-xs text-destructive-foreground">Submit</button>
            <button onClick={() => setShowReportDialog(false)} className="rounded bg-muted px-3 py-1 text-xs text-foreground">Cancel</button>
          </div>
        </div>
      )}

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
              {REACTIONS.map((r) => (
                <motion.button key={r.type} whileHover={{ scale: 1.4, y: -4 }} whileTap={{ scale: 0.9 }}
                  onClick={() => { onReaction(post.id, r.type); setShowReactions(false); }}
                  className="text-xl px-1 py-0.5 transition-transform" title={r.label}
                >{r.emoji}</motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex border-t border-border">
        <button onMouseDown={handleLongPressStart} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart} onTouchEnd={handleLongPressEnd} onClick={handleQuickTap}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
        >
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
          const url = `${window.location.origin}/feeds`;
          if (navigator.share) {
            navigator.share({ title: post.profiles?.name || "Post", text: post.content?.slice(0, 100), url }).catch(() => {});
          } else {
            navigator.clipboard.writeText(url);
            toast({ title: "Link copied to clipboard!" });
          }
        }} className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <Share2 size={18} /> Share
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
            <div className="space-y-3 px-4 py-3">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onDelete={handleDeleteComment}
                  onReport={handleReportComment}
                />
              ))}
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground">No comments yet</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2">
              <VoiceRecorder onRecordingComplete={handleVoiceComment} compact />
              <div className="flex flex-1 items-center rounded-full bg-secondary px-3 py-1.5">
                <input type="text" placeholder="Write a comment..." value={commentText}
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
