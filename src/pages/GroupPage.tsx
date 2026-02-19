import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Lock, Globe, Settings } from "lucide-react";
import { mockGroups, mockPosts } from "@/lib/mock-data";
import PostCard from "@/components/PostCard";
import { useState } from "react";

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const group = mockGroups.find((g) => g.id === groupId) ?? mockGroups[0];
  const [joined, setJoined] = useState(group.joined);
  const [posts, setPosts] = useState(mockPosts.slice(0, 2));

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
        <h2 className="flex-1 truncate text-base font-semibold text-foreground">{group.name}</h2>
        <button>
          <Settings size={20} className="text-muted-foreground" />
        </button>
      </div>

      {/* Cover */}
      <div className="pt-12">
        <div className="h-40 overflow-hidden bg-muted">
          <img src={group.coverPhoto} alt={group.name} className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Info */}
      <div className="bg-card px-4 py-4">
        <h1 className="text-lg font-bold text-foreground">{group.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {group.isPublic ? <Globe size={12} /> : <Lock size={12} />}
          <span>{group.isPublic ? "Public" : "Private"}</span>
          <span>·</span>
          <Users size={12} />
          <span>{group.memberCount.toLocaleString()} members</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
        <button
          onClick={() => setJoined(!joined)}
          className={`mt-3 w-full rounded-lg py-2.5 text-sm font-medium ${
            joined
              ? "bg-secondary text-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {joined ? "Leave Group" : "Join Group"}
        </button>
      </div>

      {/* Group feed */}
      <div className="mt-2 space-y-2 bg-muted">
        {posts.map((post) => (
          <PostCard key={post.id} post={{ ...post, groupName: group.name }} onLike={handleLike} />
        ))}
      </div>
    </div>
  );
};

export default GroupPage;
