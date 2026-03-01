import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { IncomingCallOverlay } from "@/components/CallUI";
import { useVoiceCall } from "@/hooks/useVoiceCall";

interface IncomingCallInfo {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

const GlobalCallListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);

  // Don't show global listener if already on a chat page (it has its own)
  const isOnChatPage = location.pathname.startsWith("/chat/");

  useEffect(() => {
    if (!user || isOnChatPage) return;

    const channel = supabase
      .channel("global-incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_sessions",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as any;
          if (call.status !== "ringing") return;

          // Fetch caller profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", call.caller_id)
            .single();

          setIncomingCall({
            callId: call.id,
            callerId: call.caller_id,
            callerName: profile?.name || "Unknown",
            callerAvatar: profile?.avatar_url || undefined,
          });

          // Play ringtone sound
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRl9vT19teleRBVkUAAAAAABAAAAABAAEARKwAAIhYAQACABAAZGF0YQ==");
            audio.loop = true;
            audio.play().catch(() => {});
            // Store for cleanup
            (window as any).__ringtoneAudio = audio;
          } catch {}

          // Auto-dismiss after 30 seconds
          setTimeout(() => {
            setIncomingCall((prev) => (prev?.callId === call.id ? null : prev));
            stopRingtone();
          }, 30000);
        }
      )
      .subscribe();

    // Listen for call status changes to dismiss
    const statusChannel = supabase
      .channel("global-call-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_sessions",
        },
        (payload) => {
          const call = payload.new as any;
          if (call.receiver_id === user.id && (call.status === "ended" || call.status === "rejected" || call.status === "connected")) {
            setIncomingCall((prev) => (prev?.callId === call.id ? null : prev));
            stopRingtone();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(statusChannel);
      stopRingtone();
    };
  }, [user, isOnChatPage]);

  const stopRingtone = () => {
    const audio = (window as any).__ringtoneAudio;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      delete (window as any).__ringtoneAudio;
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    await supabase
      .from("call_sessions")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);
    setIncomingCall(null);
    stopRingtone();
  };

  const handleAnswer = () => {
    if (!incomingCall) return;
    // Navigate to the chat page to handle the call there
    stopRingtone();
    window.location.href = `/chat/${incomingCall.callerId}?answerCall=${incomingCall.callId}`;
  };

  if (isOnChatPage || !incomingCall) return null;

  return (
    <AnimatePresence>
      <IncomingCallOverlay
        callerName={incomingCall.callerName}
        callerAvatar={incomingCall.callerAvatar}
        onAnswer={handleAnswer}
        onReject={handleReject}
      />
    </AnimatePresence>
  );
};

export default GlobalCallListener;
