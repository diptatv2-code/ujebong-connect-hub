import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface UseVoiceCallOptions {
  partnerId: string;
  onIncomingCall?: (callId: string, callerId: string) => void;
}

const DEBUG_VOICE = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_VOICE) console.log("[VoiceCall]", ...args);
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const { data, error } = await supabase.functions.invoke("get-turn-credentials");
    if (!error && data?.iceServers?.length) return data.iceServers;
  } catch {
    // fall through to fallback
  }
  return ICE_SERVERS;
};

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
  const callIdRef = useRef<string | null>(null);
  const endCallRef = useRef<() => void>(() => {});
  const offerSentRef = useRef(false);
  const isReceiverRef = useRef(false);
  const callerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusRef = useRef<CallStatus>("idle");

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Create audio element once (important for mobile autoplay)
  useEffect(() => {
    if (!remoteAudio.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      (audio as unknown as { playsInline: boolean }).playsInline = true;
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
    if (callerTimeoutRef.current) {
      clearTimeout(callerTimeoutRef.current);
      callerTimeoutRef.current = null;
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
    offerSentRef.current = false;
    isReceiverRef.current = false;
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
        console.error("[VoiceCall] Error adding ICE candidate:", e);
      }
    } else {
      debugLog("Buffering ICE candidate (no remote desc yet)");
      iceCandidateBuffer.current.push(candidate);
    }
  }, []);

  const flushIceCandidates = useCallback(async () => {
    if (!peerConnection.current) return;
    hasRemoteDescription.current = true;
    debugLog("Flushing", iceCandidateBuffer.current.length, "buffered ICE candidates");
    for (const candidate of iceCandidateBuffer.current) {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[VoiceCall] Error adding buffered ICE candidate:", e);
      }
    }
    iceCandidateBuffer.current = [];
  }, []);

  const playRemoteAudio = useCallback((stream: MediaStream) => {
    if (!remoteAudio.current) return;
    debugLog("Setting remote audio stream, tracks:", stream.getAudioTracks().length);
    remoteAudio.current.srcObject = stream;
    remoteAudio.current.volume = 1.0;

    const attemptPlay = () => {
      if (!remoteAudio.current) return;
      const playPromise = remoteAudio.current.play();
      if (playPromise) {
        playPromise.catch(() => {
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

    attemptPlay();
    setTimeout(attemptPlay, 500);
  }, []);

  const createPeerConnection = useCallback((iceServers: RTCIceServer[]) => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    debugLog("Creating peer connection with", iceServers.length, "ICE servers, Safari:", isSafari);
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: isSafari ? 0 : 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    } as RTCConfiguration);

    if (isSafari) {
      debugLog("Safari detected, adding audio transceiver");
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }

    const remoteStream = new MediaStream();

    pc.ontrack = (event) => {
      debugLog("ontrack fired - kind:", event.track.kind);
      remoteStream.addTrack(event.track);
      event.track.onunmute = () => playRemoteAudio(remoteStream);
      playRemoteAudio(remoteStream);
    };

    pc.oniceconnectionstatechange = () => {
      debugLog("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
        if (!callStartTime.current) {
          callStartTime.current = Date.now();
          durationInterval.current = setInterval(() => {
            if (callStartTime.current) {
              setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
            }
          }, 1000);

          // Cancel caller's no-answer timeout once connected
          if (callerTimeoutRef.current) {
            clearTimeout(callerTimeoutRef.current);
            callerTimeoutRef.current = null;
          }

          // Receiver writes the connected status to DB only after WebRTC actually connects
          if (isReceiverRef.current && callIdRef.current) {
            supabase
              .from("call_sessions")
              .update({ status: "connected", started_at: new Date().toISOString() })
              .eq("id", callIdRef.current)
              .then(() => {});
          }
        }

        const receivers = pc.getReceivers();
        const audioTracks = receivers
          .filter((r) => r.track && r.track.kind === "audio")
          .map((r) => r.track);
        if (audioTracks.length > 0) {
          const freshStream = new MediaStream(audioTracks);
          playRemoteAudio(freshStream);
        } else if (remoteAudio.current?.srcObject) {
          remoteAudio.current.play().catch(() => {});
        }
      }
      if (pc.iceConnectionState === "disconnected") {
        debugLog("ICE disconnected, waiting for recovery (15s)...");
        setTimeout(() => {
          if (peerConnection.current?.iceConnectionState === "disconnected") {
            debugLog("ICE still disconnected, ending call");
            endCallRef.current();
          }
        }, 15000);
      }
      if (pc.iceConnectionState === "failed") {
        console.error("[VoiceCall] ICE failed");
        endCallRef.current();
      }
    };

    pc.onconnectionstatechange = () => {
      debugLog("Connection state:", pc.connectionState);
    };

    pc.onicegatheringstatechange = () => {
      debugLog("ICE gathering state:", pc.iceGatheringState);
    };

    // Buffer all local ICE candidates until receiver acknowledges presence ("ready").
    // We do NOT override this in the SUBSCRIBED callback — the override only happens
    // after we know the remote peer is on the channel (BUG-003).
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateJson = event.candidate.toJSON();
        debugLog("Local ICE candidate (buffered):", event.candidate.type, event.candidate.protocol);
        earlyLocalCandidates.current.push(candidateJson);
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [playRemoteAudio]);

  const endCall = useCallback(async () => {
    const currentCallId = callIdRef.current;

    if (callerTimeoutRef.current) {
      clearTimeout(callerTimeoutRef.current);
      callerTimeoutRef.current = null;
    }

    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: "broadcast",
          event: "hangup",
          payload: { from: user?.id },
        });
      } catch {
        // best-effort: continue cleanup
      }
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

      const sendOfferAndFlush = () => {
        if (offerSentRef.current) return;
        if (!pendingOffer.current) {
          debugLog("ready received but offer not yet ready, will retry on next ready");
          return;
        }
        offerSentRef.current = true;
        debugLog("Receiver online, sending offer + flushing", earlyLocalCandidates.current.length, "candidates");

        // Now that the receiver is on the channel, override onicecandidate to send
        // candidates directly (no more buffering).
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate.toJSON(), from: user.id },
            });
          }
        };

        channel.send({
          type: "broadcast",
          event: "offer",
          payload: { sdp: pendingOffer.current, from: user.id },
        });

        for (const candidate of earlyLocalCandidates.current) {
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate, from: user.id },
          });
        }
        earlyLocalCandidates.current = [];
      };

      channel
        .on("broadcast", { event: "ready" }, () => {
          debugLog("Got ready from receiver");
          sendOfferAndFlush();
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          debugLog("Got answer from receiver");
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
            await flushIceCandidates();

            const checkAndPlayAudio = () => {
              if (!peerConnection.current) return;
              const receivers = peerConnection.current.getReceivers();
              const audioTracks = receivers
                .filter((r) => r.track && r.track.kind === "audio" && r.track.readyState === "live")
                .map((r) => r.track);
              if (audioTracks.length > 0) {
                playRemoteAudio(new MediaStream(audioTracks));
              }
            };

            checkAndPlayAudio();
            setTimeout(checkAndPlayAudio, 500);
            setTimeout(checkAndPlayAudio, 1500);
            setTimeout(checkAndPlayAudio, 3000);
          } catch (e) {
            console.error("[VoiceCall] Error setting remote description:", e);
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          await safeAddIceCandidate(payload.candidate);
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCallRef.current();
        })
        .subscribe((status) => {
          debugLog("Caller channel status:", status);
          // Note: We deliberately do NOT flush early candidates here. Receiver is
          // not yet subscribed and broadcast doesn't queue messages — we'd lose
          // them. Wait for the "ready" handshake from the receiver instead.
        });

      channelRef.current = channel;
    },
    [user, safeAddIceCandidate, flushIceCandidates, playRemoteAudio]
  );

  const setupReceiverSignaling = useCallback(
    (currentCallId: string, pc: RTCPeerConnection) => {
      if (!user) return;

      const channel = supabase.channel(`call:${currentCallId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          debugLog("Got offer from caller");
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
            await flushIceCandidates();
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer, from: user.id },
            });
          } catch (e) {
            console.error("[VoiceCall] Error handling offer:", e);
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          await safeAddIceCandidate(payload.candidate);
        })
        .on("broadcast", { event: "hangup" }, () => {
          endCallRef.current();
        })
        .subscribe((status) => {
          debugLog("Receiver channel status:", status);
          if (status === "SUBSCRIBED") {
            // Receiver subscribes after caller is already on channel, so it's safe
            // to flush and signal "ready" immediately.
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                channel.send({
                  type: "broadcast",
                  event: "ice-candidate",
                  payload: { candidate: event.candidate.toJSON(), from: user.id },
                });
              }
            };
            for (const candidate of earlyLocalCandidates.current) {
              channel.send({
                type: "broadcast",
                event: "ice-candidate",
                payload: { candidate, from: user.id },
              });
            }
            earlyLocalCandidates.current = [];

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
      isReceiverRef.current = false;
      const stream = await getMedia();
      const iceServers = await fetchIceServers();
      const pc = createPeerConnection(iceServers);

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        const senders = pc.getSenders();
        const audioSender = senders.find((s) => s.track === null || s.track?.kind === "audio");
        if (audioSender) {
          await audioSender.replaceTrack(stream.getAudioTracks()[0]);
        } else {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }
      } else {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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
        console.error("[VoiceCall] Failed to create call session:", error);
        cleanup();
        setCallStatus("idle");
        return;
      }

      setCallId(session.id);
      callIdRef.current = session.id;

      // Create offer FIRST so pendingOffer is populated before setupCallerSignaling
      // can fire its "ready" handler (BUG-004).
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      pendingOffer.current = offer;
      debugLog("Offer created and local description set for call:", session.id);

      // Now signaling can safely send the offer when receiver signals "ready"
      setupCallerSignaling(session.id, pc);

      // Caller no-answer timeout (BUG-017, BUG-018)
      callerTimeoutRef.current = setTimeout(async () => {
        if (callStatusRef.current === "calling" && callIdRef.current) {
          debugLog("Caller no-answer timeout — marking missed");
          await supabase
            .from("call_sessions")
            .update({ status: "missed", ended_at: new Date().toISOString() })
            .eq("id", callIdRef.current);
          endCallRef.current();
        }
      }, 60000);
    } catch (err) {
      console.error("[VoiceCall] Failed to start call:", err);
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
        isReceiverRef.current = true;

        const stream = await getMedia();
        const iceServers = await fetchIceServers();
        const pc = createPeerConnection(iceServers);

        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) {
          const senders = pc.getSenders();
          const audioSender = senders.find((s) => s.track === null || s.track?.kind === "audio");
          if (audioSender) {
            await audioSender.replaceTrack(stream.getAudioTracks()[0]);
          } else {
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          }
        } else {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }

        // Set up signaling BEFORE any SDP exchange
        setupReceiverSignaling(incomingCallId, pc);

        // BUG-019: do NOT mark "connected" here — wait for ICE to actually connect.
        debugLog("Answered call, waiting for offer...");
      } catch (err) {
        console.error("[VoiceCall] Failed to answer call:", err);
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
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "hangup",
            payload: { from: user?.id },
          });
        } catch {
          // ignore
        }
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
    setIsSpeaker((prev) => {
      const next = !prev;
      if (remoteAudio.current && "setSinkId" in remoteAudio.current) {
        (remoteAudio.current as unknown as { setSinkId?: (id: string) => Promise<void> })
          .setSinkId?.(next ? "" : "default");
      }
      return next;
    });
  }, []);

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
          const call = payload.new as { id: string; status: string; caller_id: string };
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
          const call = payload.new as { status: string };
          if (call.status === "ended" || call.status === "rejected" || call.status === "missed") {
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
