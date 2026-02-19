import { useState, useRef, useCallback } from "react";
import { Camera, RotateCcw, Check } from "lucide-react";
import { motion } from "framer-motion";

interface SelfieCaptureProps {
  onCapture: (file: File) => void;
  preview: string | null;
  onRetake: () => void;
}

const SelfieCapture = ({ onCapture, preview, onRetake }: SelfieCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const startCamera = useCallback(async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      setError("Camera access denied. Please allow camera access to take a selfie.");
    }
  }, []);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const takePicture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // Mirror the image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        stopCamera();
      }
    }, "image/jpeg", 0.85);
  };

  if (preview) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-primary/30">
          <img src={preview} alt="Selfie" className="h-full w-full object-cover" />
          <div className="absolute bottom-1 right-1 rounded-full bg-success p-1">
            <Check size={14} className="text-success-foreground" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onRetake(); startCamera(); }}
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <RotateCcw size={14} /> Retake
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="hidden" />
      {streaming ? (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-primary/30">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          </div>
          <button
            type="button"
            onClick={takePicture}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
          >
            <Camera size={22} />
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={startCamera}
            className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground/60 transition-colors hover:border-primary-foreground/50"
          >
            <Camera size={32} />
            <span className="text-xs font-medium">Take Selfie</span>
          </button>
          {error && <p className="text-xs text-destructive-foreground bg-destructive/80 rounded px-2 py-1">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default SelfieCapture;
