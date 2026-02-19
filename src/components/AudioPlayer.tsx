import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AudioPlayerProps {
  path: string;
  isMine?: boolean;
}

const AudioPlayer = ({ path, isMine = false }: AudioPlayerProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (path.startsWith("http")) {
      setSrc(path);
      return;
    }
    supabase.storage.from("voice-notes").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setSrc(data.signedUrl);
    });
  }, [path]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  if (!src) return <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isMine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/20 text-primary"
        }`}
      >
        {playing ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current ml-0.5" />}
      </button>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-current/20">
          <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[9px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {formatTime(playing ? progress : duration)}
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer;
