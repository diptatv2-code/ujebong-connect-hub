import { useNavigate, useLocation } from "react-router-dom";
import { Bell, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (location.pathname === "/login" || location.pathname === "/signup") return null;

  const initial = user?.user_metadata?.name?.[0]?.toUpperCase() || "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card safe-top">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <h1 className="cursor-pointer text-xl font-extrabold text-primary" onClick={() => navigate("/")}>
          Ujebong <span className="text-xs font-normal text-muted-foreground ml-1">by Pop Senek & Dipta</span>
        </h1>
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <MessageCircle size={18} className="text-foreground" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <Bell size={18} className="text-foreground" />
          </button>
          <button onClick={() => navigate(`/profile/${user?.id}`)} className="ml-1 h-8 w-8 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            {initial}
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
