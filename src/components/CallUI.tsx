import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-primary/90 to-primary"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Pulsing ring */}
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute -inset-4 rounded-full bg-primary-foreground/20"
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.3, ease: "easeInOut" }}
            className="absolute -inset-2 rounded-full bg-primary-foreground/15"
          />
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
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-primary-foreground">{callerName}</h2>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="mt-1 text-sm text-primary-foreground/70"
          >
            Incoming voice call...
          </motion.p>
        </div>

        <div className="mt-8 flex items-center gap-16">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform active:scale-95"
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-xs text-primary-foreground/70">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <motion.button
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              onClick={onAnswer}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform active:scale-95"
            >
              <Phone size={28} />
            </motion.button>
            <span className="text-xs text-primary-foreground/70">Accept</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ActiveCallScreenProps {
  partnerName: string;
  partnerAvatar?: string;
  callStatus: CallStatus;
  duration: number;
  isMuted: boolean;
  isSpeaker: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export const ActiveCallScreen = ({
  partnerName,
  partnerAvatar,
  callStatus,
  duration,
  isMuted,
  isSpeaker,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}: ActiveCallScreenProps) => {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b from-[hsl(220,20%,15%)] to-[hsl(220,20%,8%)] py-16 safe-top safe-bottom"
    >
      {/* Top: Partner info */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Avatar */}
        <div className="relative">
          {callStatus === "connected" && (
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="absolute -inset-3 rounded-full bg-green-500/20"
            />
          )}
          {callStatus === "calling" && (
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="absolute -inset-3 rounded-full bg-white/10"
            />
          )}
          {partnerAvatar ? (
            <img
              src={partnerAvatar}
              alt=""
              className="h-32 w-32 rounded-full border-4 border-white/10 object-cover shadow-2xl"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/10 bg-white/10 text-5xl font-bold text-white shadow-2xl">
              {partnerName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name & status */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">{partnerName}</h2>
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-1 text-sm font-medium ${
              callStatus === "connected" ? "text-green-400" : "text-white/60"
            }`}
          >
            {callStatus === "calling" && (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {statusText}
              </motion.span>
            )}
            {callStatus !== "calling" && statusText}
          </motion.p>
        </div>
      </motion.div>

      {/* Middle: Encryption notice (like WhatsApp) */}
      {callStatus === "connected" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-white/40">Voice call connected</span>
        </motion.div>
      )}
      {callStatus === "calling" && <div />}

      {/* Bottom: Call controls */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-8"
      >
        {/* Action buttons row */}
        <div className="flex items-center gap-8">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleMute}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                isMuted
                  ? "bg-white text-[hsl(220,20%,15%)]"
                  : "bg-white/15 text-white"
              }`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <span className="text-[11px] text-white/50">
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleSpeaker}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                isSpeaker
                  ? "bg-white text-[hsl(220,20%,15%)]"
                  : "bg-white/15 text-white"
              }`}
            >
              {isSpeaker ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
            <span className="text-[11px] text-white/50">
              {isSpeaker ? "Speaker" : "Earpiece"}
            </span>
          </div>
        </div>

        {/* End call button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onEndCall}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-transform active:scale-95"
          >
            <PhoneOff size={28} />
          </button>
          <span className="text-xs text-white/50">End</span>
        </div>
      </motion.div>
    </motion.div>
  );
};
