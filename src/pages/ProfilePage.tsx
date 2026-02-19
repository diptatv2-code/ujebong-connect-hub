import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, UserPlus, MessageCircle, Camera } from "lucide-react";
import { mockUsers, mockPosts } from "@/lib/mock-data";
import PostCard from "@/components/PostCard";
import { useState } from "react";

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const user = mockUsers.find((u) => u.id === userId) ?? mockUsers[0];
  const isOwnProfile = userId === "1";
  const userPosts = mockPosts.filter((p) => p.userId === userId);

  const [posts, setPosts] = useState(userPosts);

  const handleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      )
    );
  };

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 bg-card/80 backdrop-blur-md px-4 py-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h2 className="text-base font-semibold text-foreground">{user.name}</h2>
        {isOwnProfile && (
          <button className="ml-auto">
            <Settings size={20} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Cover + Avatar */}
      <div className="relative pt-12">
        <div className="h-36 bg-gradient-to-br from-primary/30 to-primary/10" />
        <div className="absolute -bottom-12 left-4 rounded-full border-4 border-card">
          <img
            src={user.avatar}
            alt={user.name}
            className="h-24 w-24 rounded-full bg-muted object-cover"
          />
          {isOwnProfile && (
            <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border">
              <Camera size={14} className="text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-14 px-4">
        <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.bio}</p>
        <p className="mt-1 text-xs text-muted-foreground">{user.friendCount} friends</p>

        <div className="mt-3 flex gap-2">
          {isOwnProfile ? (
            <button className="flex-1 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">
              Edit Profile
            </button>
          ) : (
            <>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground">
                <UserPlus size={16} />
                {user.isFriend ? "Friends" : "Add Friend"}
              </button>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-sm font-medium text-foreground">
                <MessageCircle size={16} />
                Message
              </button>
            </>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="mt-4 border-t border-border">
        <h3 className="px-4 py-3 text-sm font-semibold text-foreground">Posts</h3>
        {posts.length > 0 ? (
          <div className="space-y-2 bg-muted">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No posts yet</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
