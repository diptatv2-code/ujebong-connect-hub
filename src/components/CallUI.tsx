import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CallStatus } from "@/hooks/useVoiceCall";

interface IncomingCallOverlayProps {
  callerName: string;
  callerAvatar?: string;
  onAnswer: () => void;
  onReject: () => void;
}

export const IncomingCallOverlay = ({
  callerName,
  callerAvatar,
  onAnswer,
  onReject,
}: IncomingCallOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-primary"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt=""
              className="h-28 w-28 rounded-full border-4 border-primary-foreground/30 object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary-foreground/30 bg-primary-foreground/20 text-4xl font-bold text-primary-foreground">
              {callerName[0]?.toUpperCase()}
            </div>
          )}
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -inset-2 rounded-full border-2 border-primary-foreground/20"
          />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-primary-foreground">{callerName}</h2>
          <p className="mt-1 text-sm text-primary-foreground/70">Incoming voice call...</p>
        </div>

        <div className="mt-8 flex items-center gap-12">
          <button
            onClick={onReject}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform active:scale-95"
          >
            <PhoneOff size={28} />
          </button>
          <button
            onClick={onAnswer}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform active:scale-95"
          >
            <Phone size={28} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ActiveCallBarProps {
  partnerName: string;
  callStatus: CallStatus;
  duration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export const ActiveCallBar = ({
  partnerName,
  callStatus,
  duration,
  isMuted,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}: ActiveCallBarProps) => {
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const statusText =
    callStatus === "calling"
      ? "Calling..."
      : callStatus === "ringing"
        ? "Ringing..."
        : callStatus === "connected"
          ? formatDuration(duration)
          : "";

  return (
    <motion.div
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      exit={{ y: -60 }}
      className="fixed left-0 right-0 top-0 z-[150] mx-auto max-w-lg"
    >
      <div className="flex items-center justify-between bg-green-600 px-4 py-3 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <motion.div
            animate={callStatus === "connected" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className="h-2.5 w-2.5 rounded-full bg-white"
          />
          <div>
            <p className="text-sm font-semibold">{partnerName}</p>
            <p className="text-xs opacity-80">{statusText}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMute}
            className={`rounded-full p-2 transition-colors ${isMuted ? "bg-white/30" : "bg-white/10"}`}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={onToggleSpeaker}
            className="rounded-full bg-white/10 p-2 transition-colors"
          >
            <Volume2 size={18} />
          </button>
          <button
            onClick={onEndCall}
            className="rounded-full bg-red-500 p-2 transition-colors"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
