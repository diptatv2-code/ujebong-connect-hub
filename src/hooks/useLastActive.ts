import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Updates the current user's last_active_at timestamp periodically.
 * Call this once in a top-level component (e.g. App).
 */
export const useLastActive = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const update = () => {
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq("id", user.id)
        .then(() => {});
    };

    // Update immediately
    update();

    // Then every 60 seconds
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [user]);
};
