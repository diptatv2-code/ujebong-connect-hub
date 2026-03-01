import { useState, useEffect } from "react";
import { Plus, Briefcase, MapPin, Clock, Search } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const JOB_TYPES = ["full-time", "part-time", "contract", "internship", "remote", "freelance"];

interface Job {
  id: string;
  user_id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  job_type: string;
  salary_range: string;
  contact_info: string;
  is_active: boolean;
  created_at: string;
  profiles?: { name: string; avatar_url: string } | null;
}

const JobPortalPage = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", description: "", location: "", job_type: "full-time", salary_range: "", contact_info: "" });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = async () => {
    let query = supabase.from("jobs").select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (typeFilter !== "all") query = query.eq("job_type", typeFilter);
    const { data } = await query;
    if (data) {
      const userIds = [...new Set(data.map(j => j.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setJobs(data.map(j => ({ ...j, profiles: profileMap.get(j.user_id) || null })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [typeFilter]);

  const filtered = jobs.filter(j => !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase()) || j.location.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!user || !form.title.trim() || !form.company.trim()) return;
    setCreating(true);
    try {
      await supabase.from("jobs").insert({
        user_id: user.id, title: form.title.trim(), company: form.company.trim(),
        description: form.description.trim(), location: form.location.trim(),
        job_type: form.job_type, salary_range: form.salary_range.trim(), contact_info: form.contact_info.trim(),
      });
      toast.success("Job posted!");
      setShowCreate(false);
      setForm({ title: "", company: "", description: "", location: "", job_type: "full-time", salary_range: "", contact_info: "" });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || "Failed to post job");
    } finally {
      setCreating(false);
    }
  };

  const typeLabel = (t: string) => t.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="pb-16 pt-header">
      <div className="sticky top-header z-30 bg-card border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Briefcase size={20} className="text-primary" /> Job Portal
          </h2>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} /> Post Job</Button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => setTypeFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>All</button>
          {JOB_TYPES.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {typeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        )) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No jobs found</p>
          </div>
        ) : filtered.map(job => (
          <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedJob(job)}
            className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                <p className="text-xs text-primary font-medium mt-0.5">{job.company}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {typeLabel(job.job_type)}
              </span>
            </div>
            {job.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{job.description}</p>}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              {job.location && <span className="flex items-center gap-1"><MapPin size={10} /> {job.location}</span>}
              {job.salary_range && <span className="font-medium text-foreground">{job.salary_range}</span>}
              <span className="flex items-center gap-1"><Clock size={10} /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Job Detail */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader><DialogTitle>{selectedJob.title}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm font-medium text-primary">{selectedJob.company}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5">{typeLabel(selectedJob.job_type)}</span>
                  {selectedJob.location && <span className="rounded-full bg-secondary px-2 py-0.5">{selectedJob.location}</span>}
                  {selectedJob.salary_range && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">{selectedJob.salary_range}</span>}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedJob.description}</p>
                {selectedJob.contact_info && (
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs font-medium text-foreground">Contact Information</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedJob.contact_info}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Posted by {selectedJob.profiles?.name || "User"} · {formatDistanceToNow(new Date(selectedJob.created_at), { addSuffix: true })}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post a Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Job title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Company name" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            <Textarea placeholder="Job description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
            <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <Select value={form.job_type} onValueChange={v => setForm(f => ({ ...f, job_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JOB_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Salary range (e.g. 15,000-25,000 BDT)" value={form.salary_range} onChange={e => setForm(f => ({ ...f, salary_range: e.target.value }))} />
            <Input placeholder="Contact info (email/phone)" value={form.contact_info} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} />
            <Button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.company.trim()} className="w-full">
              {creating ? "Posting..." : "Post Job"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobPortalPage;
