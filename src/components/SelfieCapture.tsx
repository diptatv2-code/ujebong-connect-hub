import { useRef } from "react";
import { Camera, RotateCcw, Check, Upload } from "lucide-react";
import { motion } from "framer-motion";

interface SelfieCaptureProps {
  onCapture: (file: File) => void;
  preview: string | null;
  onRetake: () => void;
}

const SelfieCapture = ({ onCapture, preview, onRetake }: SelfieCaptureProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    onCapture(file);
  };

  if (preview) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-primary-foreground/30">
          <img src={preview} alt="Selfie" className="h-full w-full object-cover" />
          <div className="absolute bottom-1 right-1 rounded-full bg-primary-foreground p-1">
            <Check size={14} className="text-primary" />
          </div>
        </div>
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground"
        >
          <RotateCcw size={14} /> Retake
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/80 transition-colors hover:border-primary-foreground/70 hover:bg-primary-foreground/20"
      >
        <Camera size={32} />
        <span className="text-xs font-medium">Take Photo</span>
      </button>

      <p className="max-w-[200px] text-center text-[11px] text-primary-foreground/60">
        This photo will be your profile picture so others can recognize you
      </p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/20 px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/30"
      >
        <Upload size={14} /> Upload Photo Instead
      </button>
    </div>
  );
};

export default SelfieCapture;
