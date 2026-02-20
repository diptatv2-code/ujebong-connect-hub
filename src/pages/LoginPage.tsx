import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SelfieCapture from "@/components/SelfieCapture";

const TURNSTILE_SITE_KEY = "0x4AAAAAACfzI-S-IHLfWXtI";
const win = window as any;

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [showVerifyMessage, setShowVerifyMessage] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const navigate = useNavigate();
  const { signUp, signIn, resendVerification } = useAuth();

  // Load Turnstile script
  useEffect(() => {
    if (document.getElementById("cf-turnstile-script")) return;
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!turnstileRef.current || !win.turnstile) return;
    if (turnstileWidgetId.current) {
      try { win.turnstile.remove(turnstileWidgetId.current); } catch {}
      turnstileWidgetId.current = null;
    }
    setTurnstileToken(null);
    turnstileWidgetId.current = win.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      theme: "auto",
    });
  }, []);

  // Render widget when switching to signup
  useEffect(() => {
    if (isSignUp) {
      // Small delay to ensure DOM is ready
      const t = setTimeout(() => {
        if (win.turnstile) {
          renderTurnstile();
        } else {
          win.onTurnstileLoad = () => renderTurnstile();
        }
      }, 100);
      return () => clearTimeout(t);
    } else {
      setTurnstileToken(null);
      if (turnstileWidgetId.current && win.turnstile) {
        try { win.turnstile.remove(turnstileWidgetId.current); } catch {}
        turnstileWidgetId.current = null;
      }
    }
  }, [isSignUp, renderTurnstile]);

  const handleSelfieCapture = (file: File) => {
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleRetake = () => {
    setSelfieFile(null);
    setSelfiePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (isSignUp && !selfieFile) {
      toast.error("Please take a selfie to complete signup");
      return;
    }
    if (isSignUp && !turnstileToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    setLoading(true);
    try {
      // Verify turnstile token server-side for signups
      if (isSignUp) {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-turnstile", {
          body: { token: turnstileToken },
        });
        if (verifyError || !verifyData?.success) {
          toast.error("CAPTCHA verification failed. Please try again.");
          // Reset widget
          renderTurnstile();
          setLoading(false);
          return;
        }
      }

      if (isSignUp) {
        const { error, userId } = await signUp(email, password, name);
        if (error) throw error;

        if (selfieFile && userId) {
          const selfiePath = `${userId}/selfie.jpg`;
          const avatarPath = `${userId}/avatar.jpg`;
          const { error: uploadErr } = await supabase.storage.from("selfies").upload(selfiePath, selfieFile);
          if (!uploadErr) {
            const { data } = supabase.storage.from("selfies").getPublicUrl(selfiePath);
            await supabase.storage.from("avatars").upload(avatarPath, selfieFile, { upsert: true });
            const { data: avatarData } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
            await supabase.from("profiles").update({
              selfie_url: data.publicUrl,
              avatar_url: avatarData.publicUrl,
            }).eq("id", userId);
          }
        }

        setShowVerifyMessage(true);
      } else {
        const { error, emailVerified } = await signIn(email, password);
        if (error) {
          throw error;
        }
        if (emailVerified === false) {
          // Get user id for resend functionality
          const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
          const uid = signInData?.user?.id;
          if (uid) {
            await supabase.auth.signOut();
            setUnverifiedUserId(uid);
          }
          setShowVerifyMessage(true);
          return;
        }
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUserId) return;
    setResendingVerification(true);
    try {
      const { error } = await resendVerification(unverifiedUserId);
      if (error) throw error;
      toast.success("Verification email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification email");
    } finally {
      setResendingVerification(false);
    }
  };

  if (showVerifyMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="text-xl font-bold text-primary-foreground">Check your email</h2>
          <p className="mt-2 text-sm text-primary-foreground/70">
            We've sent a verification link to <strong className="text-primary-foreground">{email}</strong> from <strong className="text-primary-foreground">noreply@ujebong.com</strong>. Please click the link to verify your account.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="rounded-xl bg-primary-foreground/20 px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {resendingVerification && <Loader2 size={16} className="animate-spin" />}
              Resend Verification Email
            </button>
            <button onClick={() => { setShowVerifyMessage(false); setIsSignUp(false); }} className="rounded-xl bg-primary-foreground px-6 py-3 text-sm font-bold text-primary">
              Go to Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground placeholder:text-primary-foreground/50 outline-none backdrop-blur-sm border border-primary-foreground/20";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-primary-foreground">Ujebong</h1>
        <p className="mt-1 text-xs text-primary-foreground/60">by Pop Senek & Dipta</p>
        <p className="mt-2 text-sm text-primary-foreground/70">Connect with friends and the world</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3"
      >
        {isSignUp && (
          <>
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
            <div className="flex justify-center py-2">
              <SelfieCapture onCapture={handleSelfieCapture} preview={selfiePreview} onRetake={handleRetake} />
            </div>
          </>
        )}
        <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
        <div className="relative">
          <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={6} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/50">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Honeypot - hidden from real users */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        {/* Cloudflare Turnstile CAPTCHA - only on signup */}
        {isSignUp && (
          <div className="flex justify-center py-1">
            <div ref={turnstileRef} />
          </div>
        )}

        <button type="submit" disabled={loading || (isSignUp && !turnstileToken)} className="w-full rounded-xl bg-primary-foreground py-3 text-sm font-bold text-primary disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {isSignUp ? "Create Account" : "Log In"}
        </button>

        <p className="text-center text-xs text-primary-foreground/70">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-primary-foreground underline">
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </p>
      </motion.form>
    </div>
  );
};

export default LoginPage;
