import { useState } from "react";
import { UserPlus, UserCheck, UserX, Clock, Search } from "lucide-react";
import { motion } from "framer-motion";
import { mockUsers, type User } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";

const FriendsPage = () => {
  const [users, setUsers] = useState<User[]>(mockUsers.filter((u) => u.id !== "1"));
  const [filter, setFilter] = useState<"all" | "friends" | "requests">("all");
  const navigate = useNavigate();

  const friends = users.filter((u) => u.isFriend);
  const requests = users.filter((u) => u.requestSent);
  const suggestions = users.filter((u) => !u.isFriend && !u.requestSent);

  const toggleFriend = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, isFriend: !u.isFriend, requestSent: false } : u
      )
    );
  };

  const sendRequest = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, requestSent: true } : u))
    );
  };

  return (
    <div className="pb-16 pt-14">
      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {(["all", "friends", "requests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              filter === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-1 bg-muted p-2">
        {/* Friends */}
        {(filter === "all" || filter === "friends") && friends.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Your Friends ({friends.length})
            </h3>
            <div className="space-y-3">
              {friends.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between"
                >
                  <div
                    className="flex cursor-pointer items-center gap-3"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-11 w-11 rounded-full bg-muted object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.friendCount} friends
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFriend(user.id)}
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    <UserCheck size={14} />
                    Friends
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {(filter === "all") && suggestions.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Suggested Friends</h3>
            <div className="space-y-3">
              {suggestions.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div
                    className="flex cursor-pointer items-center gap-3"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-11 w-11 rounded-full bg-muted object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.bio}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => sendRequest(user.id)}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    <UserPlus size={14} />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requests */}
        {(filter === "all" || filter === "requests") && requests.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Pending Requests</h3>
            <div className="space-y-3">
              {requests.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-11 w-11 rounded-full bg-muted object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">Request sent</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <Clock size={14} />
                    Pending
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
