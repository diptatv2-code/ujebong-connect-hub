import { Home, Users, MessageCircle, UsersRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Feeds" },
  { path: "/friends", icon: Users, label: "All Users" },
  { path: "/groups", icon: UsersRound, label: "Groups" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (["/login", "/signup", "/pending"].includes(location.pathname) || location.pathname.startsWith("/chat/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-px left-4 right-4 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <tab.icon size={22} className={isActive ? "text-primary" : "text-muted-foreground"} />
              <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
