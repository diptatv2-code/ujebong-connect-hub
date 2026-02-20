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
  // Store the local offer so we can re-send it when receiver requests
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);

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
    pendingOffer.current = null;
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
      console.log("[Call] Remote track received", event.streams.length);
      if (!remoteAudio.current) {
        remoteAudio.current = new Audio();
        remoteAudio.current.autoplay = true;
      }
      remoteAudio.current.srcObject = event.streams[0];
      remoteAudio.current.play().catch(console.error);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[Call] ICE state:", pc.iceConnectionState);
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

  // Set up signaling channel for CALLER
  const setupCallerSignaling = useCallback(
    (currentCallId: string, pc: RTCPeerConnection) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "ready" }, async () => {
          // Receiver is ready — re-send the offer
          console.log("[Call] Receiver ready, sending offer");
          if (pendingOffer.current) {
            channel.send({
              type: "broadcast",
              event: "offer",
              payload: { sdp: pendingOffer.current, from: user.id },
            });
          }
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          console.log("[Call] Got answer");
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
            console.error("[Call] Error adding ICE candidate:", e);
          }
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCall();
        })
        .subscribe();

      channelRef.current = channel;

      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: user.id },
          });
        }
      };
    },
    [user, endCall]
  );

  // Set up signaling channel for RECEIVER
  const setupReceiverSignaling = useCallback(
    (currentCallId: string, pc: RTCPeerConnection) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          console.log("[Call] Got offer, creating answer");
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
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.addIceCandidate(
              new RTCIceCandidate(payload.candidate)
            );
          } catch (e) {
            console.error("[Call] Error adding ICE candidate:", e);
          }
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCall();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Tell the caller we're ready to receive the offer
            console.log("[Call] Receiver subscribed, sending ready signal");
            channel.send({
              type: "broadcast",
              event: "ready",
              payload: { from: user.id },
            });
          }
        });

      channelRef.current = channel;

      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: user.id },
          });
        }
      };
    },
    [user, endCall]
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
        console.error("[Call] Failed to create call session:", error);
        cleanup();
        setCallStatus("idle");
        return;
      }

      setCallId(session.id);

      // Create the offer and store it
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      pendingOffer.current = offer;

      // Set up signaling — when receiver sends "ready", we'll re-send the offer
      setupCallerSignaling(session.id, pc);

      console.log("[Call] Call created, waiting for receiver to join...");
    } catch (err) {
      console.error("[Call] Failed to start call:", err);
      cleanup();
      setCallStatus("idle");
    }
  }, [user, partnerId, getMedia, createPeerConnection, setupCallerSignaling, cleanup]);

  // Answer incoming call
  const answerCall = useCallback(
    async (incomingCallId: string) => {
      if (!user) return;

      try {
        setCallId(incomingCallId);
        setCallStatus("calling"); // show "connecting" state

        const stream = await getMedia();
        const pc = createPeerConnection();

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Set up receiver signaling — will send "ready" once subscribed
        // which triggers the caller to re-send the offer
        setupReceiverSignaling(incomingCallId, pc);

        // Update call status in DB
        await supabase
          .from("call_sessions")
          .update({ status: "connected", started_at: new Date().toISOString() })
          .eq("id", incomingCallId);

        console.log("[Call] Answered call, waiting for offer...");
      } catch (err) {
        console.error("[Call] Failed to answer call:", err);
        cleanup();
        setCallStatus("idle");
      }
    },
    [user, getMedia, createPeerConnection, setupReceiverSignaling, cleanup]
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

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => !s);
    if (remoteAudio.current && "setSinkId" in remoteAudio.current) {
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
