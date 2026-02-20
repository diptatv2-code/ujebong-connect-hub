import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; userId?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; emailVerified?: boolean; userId?: string }>;
  signOut: () => Promise<void>;
  resendVerification: (userId: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (!error && data.user) {
      // Send custom verification email from ujebong.com domain
      supabase.functions.invoke("send-verification-email", {
        body: { user_id: data.user.id },
      }).catch(console.error);

      // Notify admin about new signup (fire & forget)
      supabase.functions.invoke("notify-admin", {
        body: { user_name: name },
      }).catch(console.error);

      // Sign out immediately - user must verify email first
      await supabase.auth.signOut();
    }
    return { error: error as Error | null, userId: data.user?.id };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const userId = data.user.id;

    // Check if email is verified in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_verified")
      .eq("id", userId)
      .single();

    if (!profile?.email_verified) {
      await supabase.auth.signOut();
      return { error: null, emailVerified: false, userId };
    }

    return { error: null, emailVerified: true, userId };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resendVerification = async (userId: string) => {
    const { error } = await supabase.functions.invoke("send-verification-email", {
      body: { user_id: userId },
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
