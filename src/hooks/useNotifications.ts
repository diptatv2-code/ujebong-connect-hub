import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  post_id: string | null;
  message_id: string | null;
  content: string | null;
  read_at: string | null;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string | null;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    // Enrich with actor profiles
    const actorIds = [...new Set(data.map(n => n.actor_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", actorIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched: Notification[] = data.map(n => {
      const actor = profileMap.get(n.actor_id);
      return {
        ...n,
        actor_name: actor?.name || "Someone",
        actor_avatar: actor?.avatar_url,
      };
    });

    setNotifications(enriched);
    setUnreadCount(enriched.filter(n => !n.read_at).length);
    setLoading(false);
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, loading, markAllRead, refetch: fetchNotifications };
};
