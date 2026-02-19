import { useState } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Post } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
}

const PostCard = ({ post, onLike }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate(`/profile/${post.userId}`)}
        >
          <img
            src={post.userAvatar}
            alt={post.userName}
            className="h-10 w-10 rounded-full bg-muted object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-foreground">{post.userName}</p>
            <p className="text-xs text-muted-foreground">
              {post.createdAt}
              {post.groupName && (
                <span> · <span className="text-primary">{post.groupName}</span></span>
              )}
            </p>
          </div>
        </div>
        <button className="text-muted-foreground">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Content */}
      <p className="px-4 pb-2 text-sm leading-relaxed text-foreground">{post.content}</p>

      {/* Image */}
      {post.image && (
        <div className="aspect-[3/2] w-full overflow-hidden bg-muted">
          <img
            src={post.image}
            alt="Post"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Stats */}
      {(post.likes > 0 || post.comments.length > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
          <span>{post.likes + (post.liked ? 0 : 0)} likes</span>
          <span>{post.comments.length} comments</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-border">
        <button
          onClick={() => onLike(post.id)}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
        >
          <motion.div whileTap={{ scale: 1.3 }}>
            <Heart
              size={18}
              className={post.liked ? "fill-destructive text-destructive" : "text-muted-foreground"}
            />
          </motion.div>
          <span className={post.liked ? "text-destructive" : "text-muted-foreground"}>Like</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground"
        >
          <MessageCircle size={18} />
          Comment
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground">
          <Share2 size={18} />
          Share
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-3 px-4 py-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <img
                    src={comment.userAvatar}
                    alt={comment.userName}
                    className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-muted"
                  />
                  <div className="rounded-2xl bg-secondary px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{comment.userName}</p>
                    <p className="text-xs text-foreground">{comment.content}</p>
                  </div>
                </div>
              ))}
              {post.comments.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">No comments yet</p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-2">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=you"
                alt="You"
                className="h-7 w-7 rounded-full bg-muted"
              />
              <div className="flex flex-1 items-center rounded-full bg-secondary px-3 py-1.5">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button className="text-primary">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
