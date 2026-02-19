import { useState } from "react";
import { X, Image, MapPin, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
  onPost: (content: string) => void;
}

const CreatePostDialog = ({ open, onClose, onPost }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");

  const handlePost = () => {
    if (content.trim()) {
      onPost(content);
      setContent("");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-t-2xl bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button onClick={onClose}>
                <X size={22} className="text-foreground" />
              </button>
              <h2 className="text-base font-semibold text-foreground">Create Post</h2>
              <button
                onClick={handlePost}
                disabled={!content.trim()}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Post
              </button>
            </div>

            {/* User */}
            <div className="flex items-center gap-3 px-4 pt-3">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=you"
                alt="You"
                className="h-10 w-10 rounded-full bg-muted"
              />
              <p className="text-sm font-semibold text-foreground">You</p>
            </div>

            {/* Input */}
            <textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-3">
              <button className="text-success">
                <Image size={22} />
              </button>
              <button className="text-destructive">
                <MapPin size={22} />
              </button>
              <button className="text-primary">
                <Users size={22} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreatePostDialog;
