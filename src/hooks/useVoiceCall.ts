import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseVoiceCallOptions {
  partnerId: string;
  onIncomingCall?: (callId: string, callerId: string) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export function useVoiceCall({ partnerId, onIncomingCall }: UseVoiceCallOptions) {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const callStartTime = useRef<number | null>(null);

  // Clean up
  const cleanup = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    callStartTime.current = null;
    setCallDuration(0);
  }, []);

  // Get user media
  const getMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.current = stream;
    return stream;
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = (event) => {
      if (!remoteAudio.current) {
        remoteAudio.current = new Audio();
        remoteAudio.current.autoplay = true;
      }
      remoteAudio.current.srcObject = event.streams[0];
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") {
        setCallStatus("connected");
        callStartTime.current = Date.now();
        durationInterval.current = setInterval(() => {
          if (callStartTime.current) {
            setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
          }
        }, 1000);
      }
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        endCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, []);

  // Set up signaling channel
  const setupSignaling = useCallback(
    (currentCallId: string) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (!peerConnection.current) return;
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(payload.sdp)
          );
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { sdp: answer, from: user.id },
          });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (!peerConnection.current) return;
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(payload.sdp)
          );
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.addIceCandidate(
              new RTCIceCandidate(payload.candidate)
            );
          } catch (e) {
            console.error("Error adding ICE candidate:", e);
          }
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCall();
        })
        .subscribe();

      channelRef.current = channel;

      // Send ICE candidates
      if (peerConnection.current) {
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate.toJSON(), from: user.id },
            });
          }
        };
      }
    },
    [user]
  );

  // Start outgoing call
  const startCall = useCallback(async () => {
    if (!user) return;

    try {
      setCallStatus("calling");
      const stream = await getMedia();
      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create call session in DB
      const { data: session, error } = await supabase
        .from("call_sessions")
        .insert({
          caller_id: user.id,
          receiver_id: partnerId,
          status: "ringing",
        })
        .select()
        .single();

      if (error || !session) {
        console.error("Failed to create call session:", error);
        cleanup();
        setCallStatus("idle");
        return;
      }

      setCallId(session.id);
      setupSignaling(session.id);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait a moment for channel to be ready, then send offer
      setTimeout(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { sdp: offer, from: user.id },
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to start call:", err);
      cleanup();
      setCallStatus("idle");
    }
  }, [user, partnerId, getMedia, createPeerConnection, setupSignaling, cleanup]);

  // Answer incoming call
  const answerCall = useCallback(
    async (incomingCallId: string) => {
      if (!user) return;

      try {
        setCallStatus("connected");
        setCallId(incomingCallId);

        const stream = await getMedia();
        const pc = createPeerConnection();

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        setupSignaling(incomingCallId);

        // Update call status in DB
        await supabase
          .from("call_sessions")
          .update({ status: "connected", started_at: new Date().toISOString() })
          .eq("id", incomingCallId);
      } catch (err) {
        console.error("Failed to answer call:", err);
        cleanup();
        setCallStatus("idle");
      }
    },
    [user, getMedia, createPeerConnection, setupSignaling, cleanup]
  );

  // Reject incoming call
  const rejectCall = useCallback(
    async (incomingCallId: string) => {
      await supabase
        .from("call_sessions")
        .update({ status: "rejected", ended_at: new Date().toISOString() })
        .eq("id", incomingCallId);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "hangup",
          payload: { from: user?.id },
        });
      }
      cleanup();
      setCallStatus("idle");
      setCallId(null);
    },
    [user, cleanup]
  );

  // End call
  const endCall = useCallback(async () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "hangup",
        payload: { from: user?.id },
      });
    }

    if (callId) {
      const duration = callStartTime.current
        ? Math.floor((Date.now() - callStartTime.current) / 1000)
        : 0;
      await supabase
        .from("call_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", callId);
    }

    cleanup();
    setCallStatus("idle");
    setCallId(null);
  }, [user, callId, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

  // Toggle speaker (not really controllable via WebRTC but we track it)
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => !s);
    if (remoteAudio.current && "setSinkId" in remoteAudio.current) {
      // setSinkId is available in some browsers
      (remoteAudio.current as any).setSinkId?.(isSpeaker ? "default" : "");
    }
  }, [isSpeaker]);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_sessions",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const call = payload.new as any;
          if (call.status === "ringing" && callStatus === "idle") {
            setCallId(call.id);
            setCallStatus("ringing");
            onIncomingCall?.(call.id, call.caller_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, callStatus, onIncomingCall]);

  // Listen for call status changes (e.g., caller hangs up before answer)
  useEffect(() => {
    if (!callId || !user) return;

    const channel = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_sessions",
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const call = payload.new as any;
          if (call.status === "ended" || call.status === "rejected") {
            cleanup();
            setCallStatus("idle");
            setCallId(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, user, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    callStatus,
    callId,
    isMuted,
    isSpeaker,
    callDuration,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
