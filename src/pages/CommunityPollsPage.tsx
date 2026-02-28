import { useState, useEffect } from "react";
import { Plus, BarChart3, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PollOption {
  id: string;
  option_text: string;
  vote_count: number;
}

interface Poll {
  id: string;
  user_id: string;
  question: string;
  description: string;
  ends_at: string | null;
  created_at: string;
  options: PollOption[];
  total_votes: number;
  my_vote: string | null;
  profiles?: { name: string; avatar_url: string } | null;
}

const CommunityPollsPage = () => {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const fetchPolls = async () => {
    if (!user) return;
    const { data: pollsData } = await supabase.from("community_polls").select("*").order("created_at", { ascending: false });
    if (!pollsData) { setLoading(false); return; }

    const pollIds = pollsData.map(p => p.id);
    const userIds = [...new Set(pollsData.map(p => p.user_id))];
    const [{ data: optionsData }, { data: votesData }, { data: profiles }] = await Promise.all([
      supabase.from("poll_options").select("*").in("poll_id", pollIds),
      supabase.from("poll_votes").select("*").in("poll_id", pollIds),
      supabase.from("profiles").select("id, name, avatar_url").in("id", userIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched: Poll[] = pollsData.map(p => {
      const opts = (optionsData || []).filter(o => o.poll_id === p.id);
      const votes = (votesData || []).filter(v => v.poll_id === p.id);
      const myVote = votes.find(v => v.user_id === user.id);
      return {
        ...p,
        description: p.description || "",
        options: opts.map(o => ({
          id: o.id,
          option_text: o.option_text,
          vote_count: votes.filter(v => v.option_id === o.id).length,
        })),
        total_votes: votes.length,
        my_vote: myVote?.option_id || null,
        profiles: profileMap.get(p.user_id) || null,
      };
    });

    setPolls(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPolls(); }, [user]);

  // Realtime voting
  useEffect(() => {
    const channel = supabase.channel("polls-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => fetchPolls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) return;
    const poll = polls.find(p => p.id === pollId);
    if (poll?.my_vote) {
      // Remove existing vote first
      await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", user.id);
      if (poll.my_vote === optionId) return; // just unvoting
    }
    await supabase.from("poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
  };

  const handleCreate = async () => {
    if (!user || !question.trim() || options.filter(o => o.trim()).length < 2) return;
    setCreating(true);
    try {
      const { data: poll, error } = await supabase.from("community_polls").insert({
        user_id: user.id, question: question.trim(), description: description.trim(),
      }).select().single();
      if (error) throw error;

      const validOpts = options.filter(o => o.trim());
      await supabase.from("poll_options").insert(validOpts.map(o => ({ poll_id: poll.id, option_text: o.trim() })));
      
      toast.success("Poll created!");
      setShowCreate(false);
      setQuestion(""); setDescription(""); setOptions(["", ""]);
      fetchPolls();
    } catch (err: any) {
      toast.error(err.message || "Failed to create poll");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pb-16 pt-14">
      <div className="sticky top-14 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={20} className="text-primary" /> Community Polls
        </h2>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Poll</Button>
      </div>

      <div className="space-y-3 p-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        )) : polls.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No polls yet</p>
          </div>
        ) : polls.map(poll => {
          const hasVoted = !!poll.my_vote;
          const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
          return (
            <motion.div key={poll.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">{poll.question}</h3>
                  {poll.description && <p className="text-xs text-muted-foreground mt-1">{poll.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    by {poll.profiles?.name || "User"} · {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
                    {poll.total_votes > 0 && ` · ${poll.total_votes} vote${poll.total_votes > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {poll.options.map(opt => {
                  const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                  const isMyVote = poll.my_vote === opt.id;
                  return (
                    <button key={opt.id} onClick={() => !isExpired && handleVote(poll.id, opt.id)}
                      disabled={!!isExpired}
                      className={`relative w-full rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all overflow-hidden ${isMyVote ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:border-primary/50"}`}>
                      {(hasVoted || isExpired) && (
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          className="absolute inset-y-0 left-0 bg-primary/10 rounded-lg" transition={{ duration: 0.5 }} />
                      )}
                      <span className="relative flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {isMyVote && <Check size={14} className="text-primary" />}
                          {opt.option_text}
                        </span>
                        {(hasVoted || isExpired) && <span className="text-muted-foreground">{pct}%</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {isExpired && <p className="mt-2 text-[10px] text-destructive font-medium">Poll ended</p>}
            </motion.div>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create a Poll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Ask a question..." value={question} onChange={e => setQuestion(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Options</label>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} />
                  {options.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))}>×</Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setOptions([...options, ""])} className="w-full">
                  <Plus size={14} /> Add Option
                </Button>
              )}
            </div>
            <Button onClick={handleCreate} disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2} className="w-full">
              {creating ? "Creating..." : "Create Poll"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityPollsPage;
