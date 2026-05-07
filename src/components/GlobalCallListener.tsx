import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { IncomingCallOverlay } from "@/components/CallUI";

interface IncomingCallInfo {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

const GlobalCallListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const isOnChatPage = location.pathname.startsWith("/chat/");

  const playRingtone = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ringtoneCtxRef.current = ctx;

      const beep = () => {
        if (ctx.state === "closed") return;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 440;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
      };

      beep();
      ringtoneIntervalRef.current = setInterval(beep, 1500);
    } catch {
      // AudioContext unavailable or autoplay blocked — silently fail
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    try {
      ringtoneCtxRef.current?.close();
    } catch {
      // ignore
    }
    ringtoneCtxRef.current = null;
  }, []);

  const clearDismissTimer = useCallback((callId: string) => {
    const t = dismissTimersRef.current.get(callId);
    if (t) {
      clearTimeout(t);
      dismissTimersRef.current.delete(callId);
    }
  }, []);

  useEffect(() => {
    if (!user || isOnChatPage) return;

    const dismissTimers = dismissTimersRef.current;

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
          const call = payload.new as { id: string; status: string; caller_id: string };
          if (call.status !== "ringing") return;

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

          playRingtone();

          const timerId = setTimeout(() => {
            setIncomingCall((prev) => (prev?.callId === call.id ? null : prev));
            stopRingtone();
            dismissTimers.delete(call.id);
          }, 30000);
          dismissTimers.set(call.id, timerId);
        }
      )
      .subscribe();

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
          const call = payload.new as { id: string; receiver_id: string; status: string };
          if (
            call.receiver_id === user.id &&
            ["ended", "rejected", "connected", "missed"].includes(call.status)
          ) {
            setIncomingCall((prev) => (prev?.callId === call.id ? null : prev));
            stopRingtone();
            const t = dismissTimers.get(call.id);
            if (t) {
              clearTimeout(t);
              dismissTimers.delete(call.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(statusChannel);
      stopRingtone();
      dismissTimers.forEach((t) => clearTimeout(t));
      dismissTimers.clear();
    };
  }, [user, isOnChatPage, playRingtone, stopRingtone]);

  const handleReject = async () => {
    if (!incomingCall) return;
    await supabase
      .from("call_sessions")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);
    clearDismissTimer(incomingCall.callId);
    setIncomingCall(null);
    stopRingtone();
  };

  const handleAnswer = () => {
    if (!incomingCall) return;
    stopRingtone();
    clearDismissTimer(incomingCall.callId);
    const callId = incomingCall.callId;
    const callerId = incomingCall.callerId;
    setIncomingCall(null);
    navigate(`/chat/${callerId}?answerCall=${callId}`);
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
