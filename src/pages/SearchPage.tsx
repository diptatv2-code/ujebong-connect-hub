import { useState } from "react";
import { Search, Users, Hash, TrendingUp, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { mockUsers, mockGroups } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "people" | "groups">("all");
  const navigate = useNavigate();

  const filteredUsers = mockUsers
    .filter((u) => u.id !== "1")
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  const filteredGroups = mockGroups.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="pb-16 pt-14">
      {/* Search bar */}
      <div className="bg-card px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
          <Search size={18} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Ujebong..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {(["all", "people", "groups"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2 bg-muted p-2">
        {/* People */}
        {(activeTab === "all" || activeTab === "people") && (
          <div className="rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">People</h3>
            </div>
            {filteredUsers.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">No users found</p>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
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
                    {!user.isFriend && (
                      <button className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                        <UserPlus size={12} />
                        Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Groups */}
        {(activeTab === "all" || activeTab === "groups") && (
          <div className="rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Hash size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Groups</h3>
            </div>
            {filteredGroups.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">No groups found</p>
            ) : (
              <div className="space-y-3">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="cursor-pointer overflow-hidden rounded-xl border border-border"
                    onClick={() => navigate(`/group/${group.id}`)}
                  >
                    <div className="h-20 overflow-hidden bg-muted">
                      <img
                        src={group.coverPhoto}
                        alt={group.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.memberCount.toLocaleString()} members · {group.isPublic ? "Public" : "Private"}
                          </p>
                        </div>
                        <button
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            group.joined
                              ? "bg-secondary text-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {group.joined ? "Joined" : "Join"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trending */}
        {activeTab === "all" && !query && (
          <div className="rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Trending</h3>
            </div>
            <div className="space-y-2">
              {["#Photography", "#TechTrends", "#MusicProduction", "#Fitness"].map((tag) => (
                <div key={tag} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
                  <span className="text-sm font-medium text-primary">{tag}</span>
                  <span className="text-xs text-muted-foreground">Trending</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
