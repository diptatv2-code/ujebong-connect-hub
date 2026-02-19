import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Mail, Check } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, { icon: typeof Heart; color: string }> = {
  like: { icon: Heart, color: "text-destructive" },
  comment: { icon: MessageCircle, color: "text-primary" },
  message: { icon: Mail, color: "text-accent-foreground" },
};

const NotificationItem = ({ n, onClick }: { n: Notification; onClick: () => void }) => {
  const { icon: Icon, color } = iconMap[n.type] || iconMap.comment;
  const label =
    n.type === "like" ? "liked your post" :
    n.type === "comment" ? "commented on your post" :
    "sent you a message";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-3 px-4 py-3 border-b border-border transition-colors ${!n.read_at ? "bg-primary/5" : "bg-card"}`}
    >
      <div className="relative mt-0.5">
        {n.actor_avatar ? (
          <img src={n.actor_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {n.actor_name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <div className={`absolute -bottom-1 -right-1 rounded-full bg-card p-0.5`}>
          <Icon size={14} className={color} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{n.actor_name}</span>{" "}
          <span className="text-muted-foreground">{label}</span>
        </p>
        {n.content && n.type !== "message" && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">"{n.content}"</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      {!n.read_at && <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
    </motion.div>
  );
};

const NotificationsPage = () => {
  const { notifications, unreadCount, loading, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (n.type === "message") {
      navigate(`/chat/${n.actor_id}`);
    } else if (n.post_id) {
      navigate("/");
    }
  };

  return (
    <div className="pb-16 pt-14">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h2 className="text-lg font-bold text-foreground">Notifications</h2>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-primary">
            <Check size={14} className="mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No notifications yet
        </div>
      ) : (
        notifications.map(n => (
          <NotificationItem key={n.id} n={n} onClick={() => handleClick(n)} />
        ))
      )}
    </div>
  );
};

export default NotificationsPage;
