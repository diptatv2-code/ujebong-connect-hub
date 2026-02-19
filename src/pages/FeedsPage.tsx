import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import { mockPosts, type Post } from "@/lib/mock-data";

const FeedsPage = () => {
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [showCreate, setShowCreate] = useState(false);

  const handleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handlePost = (content: string) => {
    const newPost: Post = {
      id: `p${Date.now()}`,
      userId: "1",
      userName: "You",
      userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=you",
      content,
      likes: 0,
      comments: [],
      liked: false,
      createdAt: "Just now",
    };
    setPosts((prev) => [newPost, ...prev]);
  };

  return (
    <div className="pb-16 pt-14">
      {/* Stories-like bar */}
      <div className="flex gap-3 overflow-x-auto bg-card px-4 py-3 border-b border-border">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary bg-accent">
            <Plus size={20} className="text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground">Your Story</span>
        </div>
        {["sarah", "mike", "david", "emma"].map((seed) => (
          <div key={seed} className="flex flex-col items-center gap-1">
            <div className="rounded-full border-2 border-primary p-0.5">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                alt={seed}
                className="h-12 w-12 rounded-full bg-muted"
              />
            </div>
            <span className="text-[10px] capitalize text-muted-foreground">{seed}</span>
          </div>
        ))}
      </div>

      {/* Create post prompt */}
      <div
        className="flex cursor-pointer items-center gap-3 border-b border-border bg-card px-4 py-3"
        onClick={() => setShowCreate(true)}
      >
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=you"
          alt="You"
          className="h-9 w-9 rounded-full bg-muted"
        />
        <div className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
          What's on your mind?
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-2 bg-muted pt-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onLike={handleLike} />
        ))}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} className="text-primary-foreground" />
      </motion.button>

      <CreatePostDialog open={showCreate} onClose={() => setShowCreate(false)} onPost={handlePost} />
    </div>
  );
};

export default FeedsPage;
