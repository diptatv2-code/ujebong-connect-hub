import { useState, useEffect } from "react";
import { Plus, GraduationCap, Calendar, ExternalLink, CheckCircle2, Search } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApproval } from "@/hooks/useApproval";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["scholarship", "admission", "ngo-funding", "fellowship", "other"];

interface Scholarship {
  id: string;
  user_id: string;
  title: string;
  organization: string;
  description: string;
  eligibility: string;
  deadline: string | null;
  link: string;
  category: string;
  is_verified: boolean;
  created_at: string;
  profiles?: { name: string; avatar_url: string } | null;
}

const ScholarshipPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useApproval();
  const [items, setItems] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Scholarship | null>(null);
  const [form, setForm] = useState({ title: "", organization: "", description: "", eligibility: "", deadline: "", link: "", category: "scholarship" });

  const fetchItems = async () => {
    let query = supabase.from("scholarships").select("*").order("created_at", { ascending: false });
    if (catFilter !== "all") query = query.eq("category", catFilter);
    const { data } = await query;
    if (data) {
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setItems(data.map(s => ({ ...s, profiles: profileMap.get(s.user_id) || null })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [catFilter]);

  const filtered = items.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.organization.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!user || !form.title.trim()) return;
    setCreating(true);
    try {
      await supabase.from("scholarships").insert({
        user_id: user.id, title: form.title.trim(), organization: form.organization.trim(),
        description: form.description.trim(), eligibility: form.eligibility.trim(),
        deadline: form.deadline || null, link: form.link.trim(), category: form.category,
      });
      toast.success("Scholarship posted!");
      setShowCreate(false);
      setForm({ title: "", organization: "", description: "", eligibility: "", deadline: "", link: "", category: "scholarship" });
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to post");
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id: string) => {
    await supabase.from("scholarships").update({ is_verified: true }).eq("id", id);
    toast.success("Verified!");
    fetchItems();
  };

  const catLabel = (c: string) => c.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="pb-16 pt-header">
      <div className="sticky top-header z-30 bg-card border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" /> Scholarships
          </h2>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} /> Post</Button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search scholarships..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => setCatFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catFilter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {catLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        )) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No scholarships found</p>
          </div>
        ) : filtered.map(item => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedItem(item)}
            className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                  {item.is_verified && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                </div>
                <p className="text-xs text-primary font-medium mt-0.5">{item.organization}</p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {catLabel(item.category)}
              </span>
            </div>
            {item.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              {item.deadline && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <Calendar size={10} /> Deadline: {format(new Date(item.deadline), "MMM dd, yyyy")}
                </span>
              )}
              <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedItem.title}
                  {selectedItem.is_verified && <CheckCircle2 size={16} className="text-primary" />}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm font-medium text-primary">{selectedItem.organization}</p>
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">{catLabel(selectedItem.category)}</span>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedItem.description}</p>
                {selectedItem.eligibility && (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs font-medium text-foreground">Eligibility</p>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{selectedItem.eligibility}</p>
                  </div>
                )}
                {selectedItem.deadline && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <Calendar size={12} /> Deadline: {format(new Date(selectedItem.deadline), "MMMM dd, yyyy")}
                  </p>
                )}
                {selectedItem.link && (
                  <a href={selectedItem.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                    <ExternalLink size={12} /> Apply / More Info
                  </a>
                )}
                {isAdmin && !selectedItem.is_verified && (
                  <Button onClick={() => { handleVerify(selectedItem.id); setSelectedItem(null); }} size="sm" className="w-full">
                    <CheckCircle2 size={14} /> Verify this listing
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post Scholarship / Opportunity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Organization" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            <Textarea placeholder="Eligibility requirements" value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Deadline</label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Link (optional)" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
            <Button onClick={handleCreate} disabled={creating || !form.title.trim()} className="w-full">
              {creating ? "Posting..." : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScholarshipPage;
