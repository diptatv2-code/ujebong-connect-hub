import { Clock, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const PendingApprovalPage = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning/20">
          <Clock size={40} className="text-warning" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Account Pending Approval</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Your account has been created successfully! An admin needs to approve your account before you can access Ujebong.
        </p>
        <p className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <button
          onClick={handleSignOut}
          className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 text-sm font-medium text-foreground mx-auto"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </motion.div>
    </div>
  );
};

export default PendingApprovalPage;
