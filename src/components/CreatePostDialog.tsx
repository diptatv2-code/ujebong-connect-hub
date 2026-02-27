import { useState, useRef } from "react";
import { X, Image, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
  onPost: (content: string, imageUrl?: string) => void;
  userName?: string;
}

const CreatePostDialog = ({ open, onClose, onPost, userName = "You" }: CreatePostDialogProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!content.trim() && !imageFile) return;
    setPosting(true);

    let imageUrl: string | undefined;
    if (imageFile && user) {
      try {
        imageUrl = await uploadToCloudinary(imageFile, "ujebong/posts", { maxWidth: 1080, quality: 0.75 });
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
      }
    }

    await onPost(content, imageUrl);
    setContent("");
    removeImage();
    setPosting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40" onClick={onClose}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-t-2xl bg-card" onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button onClick={onClose}><X size={22} className="text-foreground" /></button>
              <h2 className="text-base font-semibold text-foreground">Create Post</h2>
              <button onClick={handlePost} disabled={(!content.trim() && !imageFile) || posting} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 flex items-center gap-1">
                {posting && <Loader2 size={12} className="animate-spin" />}
                Post
              </button>
            </div>
            <div className="flex items-center gap-3 px-4 pt-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {userName[0]?.toUpperCase() || "U"}
              </div>
              <p className="text-sm font-semibold text-foreground">{userName}</p>
            </div>
            <textarea
              placeholder="What's on your mind?"
              value={content} onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />

            {imagePreview && (
              <div className="relative mx-4 mb-3">
                <img src={imagePreview} alt="Preview" className="w-full rounded-xl object-cover max-h-60" />
                <button onClick={removeImage} className="absolute top-2 right-2 rounded-full bg-foreground/60 p-1 text-background">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 border-t border-border px-4 py-3">
              <input type="file" accept="image/*" ref={fileRef} onChange={handleImageSelect} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary transition-colors">
                <Image size={22} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreatePostDialog;
