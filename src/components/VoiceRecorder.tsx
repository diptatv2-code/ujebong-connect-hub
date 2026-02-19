import { useState, useRef, useCallback } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceRecorderProps {
  onRecordingComplete: (file: File) => void;
  onCancel?: () => void;
  compact?: boolean;
}

const VoiceRecorder = ({ onRecordingComplete, onCancel, compact = false }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        onRecordingComplete(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      // Microphone permission denied
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel?.();
  }, [isRecording, onCancel]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <AnimatePresence mode="wait">
      {!isRecording ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={startRecording}
          className={`shrink-0 text-muted-foreground ${compact ? "h-7 w-7" : ""}`}
        >
          <Mic size={compact ? 14 : 20} />
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-2"
        >
          <Button type="button" variant="ghost" size="icon" onClick={cancelRecording} className="shrink-0 h-8 w-8 text-destructive">
            <X size={16} />
          </Button>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-destructive">{formatTime(duration)}</span>
          </div>
          <Button type="button" size="icon" onClick={stopRecording} className="shrink-0 h-8 w-8 bg-destructive hover:bg-destructive/90">
            <Square size={12} className="fill-current" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceRecorder;
