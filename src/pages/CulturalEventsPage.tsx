import { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CloudinaryImage from "@/components/CloudinaryImage";
import { uploadToCloudinary } from "@/lib/cloudinary";

const DISTRICTS = ["all", "Khagrachhari", "Rangamati", "Bandarban", "Dhaka", "Chittagong", "Other"];
const CATEGORIES = ["festival", "celebration", "traditional", "music", "dance", "other"];

interface CulturalEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  end_date: string | null;
  location: string;
  district: string;
  image_url: string | null;
  category: string;
  created_at: string;
  profiles?: { name: string; avatar_url: string } | null;
}

const CulturalEventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CulturalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", event_date: "", end_date: "", location: "", district: "all", category: "festival" });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchEvents = async () => {
    let query = supabase.from("cultural_events").select("*").order("event_date", { ascending: true });
    if (filter !== "all") query = query.eq("district", filter);
    const { data } = await query;
    if (data) {
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setEvents(data.map(e => ({ ...e, profiles: profileMap.get(e.user_id) || null })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [filter]);

  const handleCreate = async () => {
    if (!user || !form.title.trim() || !form.event_date) return;
    setCreating(true);
    try {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadToCloudinary(imageFile, "ujebong/events");
      await supabase.from("cultural_events").insert({
        user_id: user.id, title: form.title.trim(), description: form.description.trim(),
        event_date: form.event_date, end_date: form.end_date || null, location: form.location.trim(),
        district: form.district, category: form.category, image_url: imageUrl,
      });
      toast.success("Event created!");
      setShowCreate(false);
      setForm({ title: "", description: "", event_date: "", end_date: "", location: "", district: "all", category: "festival" });
      setImageFile(null);
      fetchEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const categoryColors: Record<string, string> = {
    festival: "bg-primary/10 text-primary",
    celebration: "bg-accent text-accent-foreground",
    traditional: "bg-secondary text-secondary-foreground",
    music: "bg-primary/20 text-primary",
    dance: "bg-destructive/10 text-destructive",
    other: "bg-muted text-muted-foreground",
  };

  return (
    <div className="pb-16 pt-14">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar size={20} className="text-primary" /> Cultural Events
          </h2>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Post Event
          </Button>
        </div>
        {/* District Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DISTRICTS.map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {d === "all" ? "All Districts" : d}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3 p-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        )) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No cultural events found</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to post an event!</p>
          </div>
        ) : events.map(event => (
          <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {event.image_url && (
              <CloudinaryImage src={event.image_url} alt={event.title} className="w-full h-40 object-cover" width={600} />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1 ${categoryColors[event.category] || categoryColors.other}`}>
                    {event.category}
                  </span>
                  <h3 className="text-base font-bold text-foreground">{event.title}</h3>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-lg font-bold text-primary">{format(new Date(event.event_date), "dd")}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(event.event_date), "MMM yyyy")}</p>
                </div>
              </div>
              {event.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{event.description}</p>}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {event.location && <span className="flex items-center gap-1"><MapPin size={12} /> {event.location}</span>}
                {event.district !== "all" && <span className="flex items-center gap-1"><Filter size={12} /> {event.district}</span>}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Posted by {event.profiles?.name || "User"}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post Cultural Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Event title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date (opt)</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.district} onValueChange={v => setForm(f => ({ ...f, district: v }))}>
                <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                <SelectContent>{DISTRICTS.map(d => <SelectItem key={d} value={d}>{d === "all" ? "All" : d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Event Image (optional)</label>
              <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.event_date} className="w-full">
              {creating ? "Creating..." : "Post Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CulturalEventsPage;
