import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Updates the current user's last_active_at timestamp periodically.
 * Pauses while the tab is hidden so backgrounded tabs don't keep writing.
 * Call this once in a top-level component (e.g. App).
 */
export const useLastActive = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const update = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() } as never)
        .eq("id", user.id)
        .then(() => {});
    };

    update();
    const interval = setInterval(update, 60_000);

    const onVisibility = () => {
      if (!document.hidden) update();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);
};
