import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseVoiceCallOptions {
  partnerId: string;
  onIncomingCall?: (callId: string, callerId: string) => void;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

async function fetchTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    const { data, error } = await supabase.functions.invoke("get-turn-credentials");
    if (error) {
      console.error("[Call] Failed to fetch TURN credentials:", error);
      return FALLBACK_ICE_SERVERS;
    }
    console.log("[Call] Got ICE servers from Metered, fallback:", data.fallback ?? false);
    return data.iceServers;
  } catch (e) {
    console.error("[Call] Error fetching TURN credentials:", e);
    return FALLBACK_ICE_SERVERS;
  }
}

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
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescription = useRef(false);
  // Use refs for values needed inside createPeerConnection to avoid stale closures
  const callIdRef = useRef<string | null>(null);
  const endCallRef = useRef<() => void>(() => {});

  // Keep callIdRef in sync
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  // Create audio element once (important for mobile autoplay)
  useEffect(() => {
    if (!remoteAudio.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      // Append to DOM for mobile compatibility
      audio.style.display = "none";
      document.body.appendChild(audio);
      remoteAudio.current = audio;
    }
    return () => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = null;
        remoteAudio.current.remove();
        remoteAudio.current = null;
      }
    };
  }, []);

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
    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }
    pendingOffer.current = null;
    callStartTime.current = null;
    iceCandidateBuffer.current = [];
    hasRemoteDescription.current = false;
    setCallDuration(0);
  }, []);

  const getMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.current = stream;
    return stream;
  }, []);

  const safeAddIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnection.current) return;
    if (hasRemoteDescription.current) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[Call] Error adding ICE candidate:", e);
      }
    } else {
      console.log("[Call] Buffering ICE candidate (no remote desc yet)");
      iceCandidateBuffer.current.push(candidate);
    }
  }, []);

  const flushIceCandidates = useCallback(async () => {
    if (!peerConnection.current) return;
    hasRemoteDescription.current = true;
    console.log("[Call] Flushing", iceCandidateBuffer.current.length, "buffered ICE candidates");
    for (const candidate of iceCandidateBuffer.current) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[Call] Error adding buffered ICE candidate:", e);
      }
    }
    iceCandidateBuffer.current = [];
  }, []);

  const createPeerConnection = useCallback((iceServers: RTCIceServer[]) => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log("[Call] Creating peer connection with", iceServers.length, "ICE servers");
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: isSafari ? 0 : 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    } as RTCConfiguration);

    // Safari desktop needs a transceiver to properly negotiate audio
    if (isSafari) {
      console.log("[Call] Safari detected, adding audio transceiver");
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }

    pc.ontrack = (event) => {
      console.log("[Call] Remote track received, kind:", event.track.kind, "readyState:", event.track.readyState);
      if (remoteAudio.current) {
        // Use streams if available, otherwise create a new MediaStream from the track
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        remoteAudio.current.srcObject = stream;
        // Force play with user gesture workaround
        const playPromise = remoteAudio.current.play();
        if (playPromise) {
          playPromise.catch((e) => {
            console.warn("[Call] Audio autoplay blocked, retrying:", e);
            // Retry on next user interaction
            const resumeAudio = () => {
              remoteAudio.current?.play().catch(() => {});
              document.removeEventListener("touchstart", resumeAudio);
              document.removeEventListener("click", resumeAudio);
            };
            document.addEventListener("touchstart", resumeAudio, { once: true });
            document.addEventListener("click", resumeAudio, { once: true });
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[Call] ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
        if (!callStartTime.current) {
          callStartTime.current = Date.now();
          durationInterval.current = setInterval(() => {
            if (callStartTime.current) {
              setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
            }
          }, 1000);
        }
      }
      if (pc.iceConnectionState === "disconnected") {
        console.warn("[Call] ICE disconnected, waiting for recovery...");
        // Give ICE a chance to recover before ending
        setTimeout(() => {
          if (peerConnection.current?.iceConnectionState === "disconnected") {
            console.log("[Call] ICE still disconnected, ending call");
            endCallRef.current();
          }
        }, 5000);
      }
      if (pc.iceConnectionState === "failed") {
        console.error("[Call] ICE failed");
        endCallRef.current();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[Call] Connection state:", pc.connectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log("[Call] ICE gathering state:", pc.iceGatheringState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[Call] Local ICE candidate:", event.candidate.type, event.candidate.protocol);
      } else {
        console.log("[Call] ICE gathering complete");
      }
    };

    peerConnection.current = pc;
    return pc;
  }, []);

  const endCall = useCallback(async () => {
    const currentCallId = callIdRef.current;
    
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "hangup",
        payload: { from: user?.id },
      });
    }

    if (currentCallId) {
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
        .eq("id", currentCallId);
    }

    cleanup();
    setCallStatus("idle");
    setCallId(null);
  }, [user, cleanup]);

  // Keep endCallRef in sync
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const setupCallerSignaling = useCallback(
    (currentCallId: string, pc: RTCPeerConnection) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "ready" }, () => {
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
          console.log("[Call] Got answer from receiver");
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
            await flushIceCandidates();
            console.log("[Call] Remote description set (answer), ICE candidates flushed");
          } catch (e) {
            console.error("[Call] Error setting remote description:", e);
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          console.log("[Call] Received remote ICE candidate");
          await safeAddIceCandidate(payload.candidate);
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCallRef.current();
        })
        .subscribe((status) => {
          console.log("[Call] Caller channel status:", status);
        });

      channelRef.current = channel;

      // Override onicecandidate to send via signaling channel
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[Call] Sending ICE candidate:", event.candidate.type, event.candidate.protocol);
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: user.id },
          });
        } else {
          console.log("[Call] ICE gathering complete");
        }
      };
    },
    [user, safeAddIceCandidate, flushIceCandidates]
  );

  const setupReceiverSignaling = useCallback(
    (currentCallId: string, pc: RTCPeerConnection) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          console.log("[Call] Got offer from caller");
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
            await flushIceCandidates();
            console.log("[Call] Remote description set (offer), creating answer...");
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            console.log("[Call] Sending answer to caller");
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer, from: user.id },
            });
          } catch (e) {
            console.error("[Call] Error handling offer:", e);
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          console.log("[Call] Received remote ICE candidate");
          await safeAddIceCandidate(payload.candidate);
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCallRef.current();
        })
        .subscribe((status) => {
          console.log("[Call] Receiver channel status:", status);
          if (status === "SUBSCRIBED") {
            console.log("[Call] Receiver subscribed, sending ready signals");
            // Send ready signals with increasing delays for reliability
            [500, 1500, 3000].forEach((delay) => {
              setTimeout(() => {
                if (channelRef.current) {
                  channel.send({
                    type: "broadcast",
                    event: "ready",
                    payload: { from: user.id },
                  });
                }
              }, delay);
            });
          }
        });

      channelRef.current = channel;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[Call] Sending ICE candidate:", event.candidate.type, event.candidate.protocol);
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: user.id },
          });
        } else {
          console.log("[Call] ICE gathering complete");
        }
      };
    },
    [user, safeAddIceCandidate, flushIceCandidates]
  );

  const startCall = useCallback(async () => {
    if (!user) return;

    try {
      setCallStatus("calling");
      const [stream, iceServers] = await Promise.all([getMedia(), fetchTurnCredentials()]);
      const pc = createPeerConnection(iceServers);

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        // Safari: replace the transceiver's track instead of addTrack
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track === null || s.track?.kind === "audio");
        if (audioSender) {
          console.log("[Call] Safari: replacing transceiver track");
          await audioSender.replaceTrack(stream.getAudioTracks()[0]);
        } else {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }
      } else {
        stream.getTracks().forEach((track) => {
          console.log("[Call] Adding local track:", track.kind, track.enabled);
          pc.addTrack(track, stream);
        });
      }

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
      callIdRef.current = session.id;

      const offer = await pc.createOffer();
      console.log("[Call] Offer SDP type:", offer.type, "sdp length:", offer.sdp?.length);
      await pc.setLocalDescription(offer);
      pendingOffer.current = offer;
      console.log("[Call] Offer created, setting up signaling for call:", session.id);

      setupCallerSignaling(session.id, pc);
    } catch (err) {
      console.error("[Call] Failed to start call:", err);
      cleanup();
      setCallStatus("idle");
    }
  }, [user, partnerId, getMedia, createPeerConnection, setupCallerSignaling, cleanup]);

  const answerCall = useCallback(
    async (incomingCallId: string) => {
      if (!user) return;

      try {
        setCallId(incomingCallId);
        callIdRef.current = incomingCallId;
        setCallStatus("calling");

        const [stream, iceServers] = await Promise.all([getMedia(), fetchTurnCredentials()]);
        const pc = createPeerConnection(iceServers);

        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track === null || s.track?.kind === "audio");
          if (audioSender) {
            console.log("[Call] Safari: replacing transceiver track");
            await audioSender.replaceTrack(stream.getAudioTracks()[0]);
          } else {
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          }
        } else {
          stream.getTracks().forEach((track) => {
            console.log("[Call] Adding local track:", track.kind, track.enabled);
            pc.addTrack(track, stream);
          });
        }

        setupReceiverSignaling(incomingCallId, pc);

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

  const toggleMute = useCallback(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

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
            callIdRef.current = call.id;
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

  // Listen for call status changes
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
