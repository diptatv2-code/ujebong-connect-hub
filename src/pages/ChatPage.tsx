import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, ImagePlus, X } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image-utils";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  audio_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
}

// Component to display images via signed URLs
const SignedImage = ({ path, className }: { path: string; className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (path.startsWith("http")) {
      setSrc(path);
      return;
    }
    supabase.storage.from("messages").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setSrc(data.signedUrl);
    });
  }, [path]);
  if (!src) return <div className={`${className} animate-pulse bg-muted rounded-lg min-h-[100px]`} />;
  return <img src={src} alt="Shared image" className={className} loading="lazy" />;
};

const ChatPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Fetch partner profile
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("id, name, avatar_url").eq("id", userId).single()
      .then(({ data }) => { if (data) setPartner(data); });
  }, [userId]);

  // Fetch messages
  const fetchMessages = async () => {
    if (!user || !userId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    setLoading(false);
    scrollToBottom();

    // Mark unread messages as read
    if (data) {
      const unread = data.filter(m => m.receiver_id === user.id && !m.read_at).map(m => m.id);
      if (unread.length > 0) {
        supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {});
      }
    }
  };

  useEffect(() => { fetchMessages(); }, [user, userId]);

  // Realtime
  useEffect(() => {
    if (!user || !userId) return;
    const channel = supabase
      .channel(`chat-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === user.id && msg.receiver_id === userId) ||
            (msg.sender_id === userId && msg.receiver_id === user.id)) {
          setMessages(prev => [...prev, msg]);
          scrollToBottom();
          // Mark as read if received
          if (msg.receiver_id === user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then(() => {});
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSend = async () => {
    if (!user || !userId || (!text.trim() && !imageFile && !audioFile)) return;
    setSending(true);

    let image_url: string | null = null;
    let audio_url: string | null = null;

    if (imageFile) {
      const compressed = await compressImage(imageFile, { maxWidth: 1080, quality: 0.75 });
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("messages").upload(path, compressed, { contentType: "image/jpeg" });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        setSending(false);
        return;
      }
      image_url = path;
    }

    if (audioFile) {
      const path = `${user.id}/${Date.now()}.webm`;
      const { error } = await supabase.storage.from("voice-notes").upload(path, audioFile);
      if (error) {
        toast({ title: "Voice upload failed", description: error.message, variant: "destructive" });
        setSending(false);
        return;
      }
      audio_url = path;
    }

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: userId,
      content: text.trim(),
      image_url,
      audio_url,
    });

    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } else {
      setText("");
      setImageFile(null);
      setImagePreview(null);
      setAudioFile(null);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")} className="shrink-0">
            <ArrowLeft size={20} />
          </Button>
          {partner && (
            <div className="flex items-center gap-2.5" onClick={() => navigate(`/profile/${partner.id}`)} role="button">
              <Avatar className="h-9 w-9">
                <AvatarImage src={partner.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {partner.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-foreground">{partner.name}</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate("/messages")} className="shrink-0">
          <X size={20} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Send the first message! 👋
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}>
                  {msg.image_url && (
                    <SignedImage
                      path={msg.image_url}
                      className="mb-1.5 max-h-56 w-full rounded-lg object-cover"
                    />
                  )}
                  {msg.audio_url && (
                    <AudioPlayer path={msg.audio_url} isMine={isMine} />
                  )}
                  {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                  <p className={`mt-0.5 text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="border-t border-border bg-card px-3 py-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Audio preview */}
      {audioFile && (
        <div className="border-t border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">🎤 Voice message ready</span>
            <button
              onClick={() => setAudioFile(null)}
              className="rounded-full bg-destructive p-0.5 text-destructive-foreground"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-3 py-2 safe-bottom">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="shrink-0 text-muted-foreground">
            <ImagePlus size={20} />
          </Button>
          <VoiceRecorder
            onRecordingComplete={(file) => setAudioFile(file)}
            onCancel={() => setAudioFile(null)}
          />
          <Input
            placeholder="Message..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || (!text.trim() && !imageFile && !audioFile)}
            className="shrink-0"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
