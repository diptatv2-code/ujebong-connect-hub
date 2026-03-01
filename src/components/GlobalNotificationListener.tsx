import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const GlobalNotificationListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-notifications-popup")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notif = payload.new as any;
          // Don't show toast for message notifications (handled by Messages tab)
          if (notif.type === "message") return;

          // Fetch actor name
          const { data: actor } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", notif.actor_id)
            .single();

          const actorName = actor?.name || "Someone";
          const label =
            notif.type === "like"
              ? "liked your post"
              : notif.type === "comment"
                ? "commented on your post"
                : notif.type === "friend_request"
                  ? "sent you a friend request"
                  : "interacted with you";

          toast(`${actorName} ${label}`, {
            action: {
              label: "View",
              onClick: () => navigate("/notifications"),
            },
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
};

export default GlobalNotificationListener;
