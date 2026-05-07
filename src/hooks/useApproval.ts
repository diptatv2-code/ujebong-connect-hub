import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useApproval = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user) { setLoading(false); return; }

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("is_approved").eq("id", user.id).single(),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);

      setIsApproved(profile?.is_approved ?? false);
      setIsAdmin(roles === true);
      setLoading(false);
    };
    check();
  }, [user]);

  // Realtime: react to admin approval/revoke without forcing logout-relogin (BUG-028)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`approval-status:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as { is_approved?: boolean };
          if (typeof next.is_approved === "boolean") {
            setIsApproved(next.is_approved);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { isApproved, isAdmin, loading };
};
