import { useNavigate, useLocation } from "react-router-dom";
import { Bell, MessageCircle } from "lucide-react";

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/login" || location.pathname === "/signup") return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card safe-top">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <h1
          className="cursor-pointer text-xl font-extrabold text-primary"
          onClick={() => navigate("/")}
        >
          Ujebong
        </h1>
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <MessageCircle size={18} className="text-foreground" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <Bell size={18} className="text-foreground" />
          </button>
          <button
            onClick={() => navigate("/profile/1")}
            className="ml-1 h-8 w-8 overflow-hidden rounded-full bg-muted"
          >
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=you"
              alt="You"
              className="h-full w-full object-cover"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
