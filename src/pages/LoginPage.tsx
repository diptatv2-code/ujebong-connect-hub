import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SelfieCapture from "@/components/SelfieCapture";

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
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();

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
    // Honeypot check - bots fill this hidden field
    if (honeypot) return;
    if (isSignUp && !selfieFile) {
      toast.error("Please take a selfie to complete signup");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error, userId } = await signUp(email, password, name);
        if (error) throw error;

        // Upload selfie and set as profile picture
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
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message?.includes("Email not confirmed")) {
            toast.error("Please verify your email before logging in. Check your inbox.");
          } else {
            throw error;
          }
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
  if (showVerifyMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20">
            <span className="text-3xl">✉️</span>
          </div>
          <h2 className="text-xl font-bold text-primary-foreground">Check your email</h2>
          <p className="mt-2 text-sm text-primary-foreground/70">
            We've sent a verification link to <strong className="text-primary-foreground">{email}</strong>. Please click the link to verify your account before logging in.
          </p>
          <button onClick={() => { setShowVerifyMessage(false); setIsSignUp(false); }} className="mt-6 rounded-xl bg-primary-foreground px-6 py-3 text-sm font-bold text-primary">
            Go to Login
          </button>
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

        {/* Honeypot - hidden from real users, bots will fill it */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary-foreground py-3 text-sm font-bold text-primary disabled:opacity-60 flex items-center justify-center gap-2">
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
