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

  return { isApproved, isAdmin, loading };
};
