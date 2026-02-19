import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  has_image: boolean;
  has_audio: boolean;
}

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchConversations = async () => {
    if (!user) return;

    // Get all messages involving current user
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!messages) { setLoading(false); return; }

    // Group by conversation partner
    const convMap = new Map<string, { last: typeof messages[0]; unread: number }>();
    for (const msg of messages) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          last: msg,
          unread: msg.receiver_id === user.id && !msg.read_at ? 1 : 0,
        });
      } else {
        const existing = convMap.get(partnerId)!;
        if (msg.receiver_id === user.id && !msg.read_at) existing.unread++;
      }
    }

    // Fetch profiles for all partners
    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) { setConversations([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", partnerIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const convos: Conversation[] = partnerIds.map(pid => {
      const { last, unread } = convMap.get(pid)!;
      const profile = profileMap.get(pid);
      return {
        user_id: pid,
        name: profile?.name || "User",
        avatar_url: profile?.avatar_url || null,
        last_message: last.content || "",
        last_message_at: last.created_at,
        unread_count: unread,
        has_image: !!last.image_url,
        has_audio: !!last.audio_url,
      };
    });

    convos.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    setConversations(convos);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-20 pt-2">
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-muted-foreground">
          <p className="text-sm">No conversations yet</p>
          <p className="mt-1 text-xs">Find friends and start chatting!</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map(conv => (
            <button
              key={conv.user_id}
              onClick={() => navigate(`/chat/${conv.user_id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conv.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {conv.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {conv.unread_count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {conv.unread_count > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`truncate text-sm ${conv.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                    {conv.name}
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                  </span>
                </div>
                <p className={`truncate text-xs ${conv.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {conv.has_audio && !conv.last_message ? "🎤 Voice message" : conv.has_image && !conv.last_message ? "📷 Photo" : conv.last_message || "📷 Photo"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
