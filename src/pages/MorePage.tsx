import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, BarChart3, Briefcase, GraduationCap, Home, UtensilsCrossed, Mountain, Building2 } from "lucide-react";

const sections = [
  { path: "/events", icon: Calendar, label: "Cultural Events", desc: "Festivals, celebrations & cultural happenings", color: "bg-primary/10 text-primary" },
  { path: "/polls", icon: BarChart3, label: "Community Polls", desc: "Vote and discuss community topics", color: "bg-accent text-accent-foreground" },
  { path: "/jobs", icon: Briefcase, label: "Job Portal", desc: "Find and post jobs for the community", color: "bg-secondary text-secondary-foreground" },
  { path: "/scholarships", icon: GraduationCap, label: "Scholarships", desc: "Scholarships, admissions & funding", color: "bg-primary/15 text-primary" },
  // Coming soon sections
  { path: "#", icon: UtensilsCrossed, label: "Food Guide", desc: "Traditional food & restaurants (Coming soon)", color: "bg-muted text-muted-foreground", soon: true },
  { path: "#", icon: Mountain, label: "Tourism Guide", desc: "Hidden spots & travel in CHT (Coming soon)", color: "bg-muted text-muted-foreground", soon: true },
  { path: "#", icon: Building2, label: "Housing Board", desc: "Find housing in cities (Coming soon)", color: "bg-muted text-muted-foreground", soon: true },
];

const MorePage = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-16 pt-14">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-foreground mb-1">Explore</h2>
        <p className="text-xs text-muted-foreground mb-4">Discover community features and services</p>
        <div className="grid grid-cols-1 gap-3">
          {sections.map((s, i) => (
            <motion.button
              key={s.path + i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => !s.soon && navigate(s.path)}
              disabled={s.soon}
              className={`flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all ${s.soon ? "opacity-60" : "hover:border-primary/30 active:scale-[0.98]"}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{s.label}</p>
                  {s.soon && <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">Soon</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MorePage;
