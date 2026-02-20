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
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);
  const earlyLocalCandidates = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescription = useRef(false);
  const signalingReady = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const endCallRef = useRef<() => void>(() => {});

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
    earlyLocalCandidates.current = [];
    hasRemoteDescription.current = false;
    signalingReady.current = false;
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

  const playRemoteAudio = useCallback((stream: MediaStream) => {
    if (!remoteAudio.current) return;
    console.log("[Call] Setting remote audio stream, tracks:", stream.getAudioTracks().length);
    stream.getAudioTracks().forEach((track) => {
      console.log("[Call] Remote audio track - enabled:", track.enabled, "readyState:", track.readyState, "muted:", track.muted);
    });
    remoteAudio.current.srcObject = stream;
    remoteAudio.current.volume = 1.0;
    
    const attemptPlay = () => {
      if (!remoteAudio.current) return;
      const playPromise = remoteAudio.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            console.log("[Call] Remote audio playing successfully");
          })
          .catch((e) => {
            console.warn("[Call] Audio autoplay blocked, will retry on interaction:", e);
            const resumeAudio = () => {
              remoteAudio.current?.play().catch(() => {});
              document.removeEventListener("touchstart", resumeAudio);
              document.removeEventListener("click", resumeAudio);
            };
            document.addEventListener("touchstart", resumeAudio, { once: true });
            document.addEventListener("click", resumeAudio, { once: true });
          });
      }
    };

    // Try playing immediately
    attemptPlay();
    // Also retry after a short delay in case the track isn't ready yet
    setTimeout(attemptPlay, 500);
  }, []);

  const createPeerConnection = useCallback((iceServers: RTCIceServer[]) => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log("[Call] Creating peer connection with", iceServers.length, "ICE servers, Safari:", isSafari);
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: isSafari ? 0 : 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    } as RTCConfiguration);

    if (isSafari) {
      console.log("[Call] Safari detected, adding audio transceiver");
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }

    pc.ontrack = (event) => {
      console.log("[Call] ontrack fired - kind:", event.track.kind, "readyState:", event.track.readyState, "streams:", event.streams.length);
      const stream = event.streams?.[0] || new MediaStream([event.track]);

      // Monitor the track for state changes
      event.track.onunmute = () => {
        console.log("[Call] Remote track unmuted");
        playRemoteAudio(stream);
      };
      event.track.onended = () => {
        console.log("[Call] Remote track ended");
      };

      playRemoteAudio(stream);
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
        // Re-attempt audio playback when ICE connects (covers edge cases)
        if (remoteAudio.current?.srcObject) {
          remoteAudio.current.play().catch(() => {});
        }
      }
      if (pc.iceConnectionState === "disconnected") {
        console.warn("[Call] ICE disconnected, waiting for recovery...");
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

    // Buffer local ICE candidates until signaling channel is ready
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateJson = event.candidate.toJSON();
        console.log("[Call] Local ICE candidate (pre-signaling):", event.candidate.type, event.candidate.protocol);
        earlyLocalCandidates.current.push(candidateJson);
      } else {
        console.log("[Call] ICE gathering complete");
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [playRemoteAudio]);

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
          if (status === "SUBSCRIBED") {
            signalingReady.current = true;
            // Now override onicecandidate to send directly via channel
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                console.log("[Call] Sending ICE candidate:", event.candidate.type, event.candidate.protocol);
                channel.send({
                  type: "broadcast",
                  event: "ice-candidate",
                  payload: { candidate: event.candidate.toJSON(), from: user.id },
                });
              }
            };
            // Flush any early candidates that were buffered before signaling was ready
            console.log("[Call] Flushing", earlyLocalCandidates.current.length, "early local ICE candidates");
            for (const candidate of earlyLocalCandidates.current) {
              channel.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate, from: user.id },
              });
            }
            earlyLocalCandidates.current = [];
          }
        });

      channelRef.current = channel;
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
            signalingReady.current = true;
            // Override onicecandidate to send via channel
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                console.log("[Call] Sending ICE candidate:", event.candidate.type, event.candidate.protocol);
                channel.send({
                  type: "broadcast",
                  event: "ice-candidate",
                  payload: { candidate: event.candidate.toJSON(), from: user.id },
                });
              }
            };
            // Flush early local candidates
            console.log("[Call] Flushing", earlyLocalCandidates.current.length, "early local ICE candidates");
            for (const candidate of earlyLocalCandidates.current) {
              channel.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate, from: user.id },
              });
            }
            earlyLocalCandidates.current = [];

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
    },
    [user, safeAddIceCandidate, flushIceCandidates]
  );

  const startCall = useCallback(async () => {
    if (!user) return;

    try {
      setCallStatus("calling");
      const stream = await getMedia();
      const pc = createPeerConnection(ICE_SERVERS);

      // Add local audio tracks to the peer connection
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
          console.log("[Call] Adding local track:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
          pc.addTrack(track, stream);
        });
      }

      // Verify audio tracks are attached
      const senders = pc.getSenders();
      console.log("[Call] PC senders after addTrack:", senders.length, senders.map(s => `${s.track?.kind}:${s.track?.enabled}:${s.track?.readyState}`));

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

      // Set up signaling BEFORE creating the offer to avoid losing early ICE candidates
      setupCallerSignaling(session.id, pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      console.log("[Call] Offer SDP type:", offer.type, "sdp length:", offer.sdp?.length);
      
      // Verify the offer SDP contains audio
      if (offer.sdp) {
        const hasAudio = offer.sdp.includes("m=audio");
        console.log("[Call] Offer SDP has audio m-line:", hasAudio);
      }

      await pc.setLocalDescription(offer);
      pendingOffer.current = offer;
      console.log("[Call] Offer created and local description set for call:", session.id);
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

        const stream = await getMedia();
        const pc = createPeerConnection(ICE_SERVERS);

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
            console.log("[Call] Adding local track:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
            pc.addTrack(track, stream);
          });
        }

        // Verify audio tracks are attached
        const senders = pc.getSenders();
        console.log("[Call] PC senders after addTrack:", senders.length, senders.map(s => `${s.track?.kind}:${s.track?.enabled}:${s.track?.readyState}`));

        // Set up signaling BEFORE any SDP exchange to avoid losing ICE candidates
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
