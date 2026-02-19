import { useState, useEffect } from "react";
import { Download, Share, MoreVertical, CheckCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 pt-14 text-center">
        <CheckCircle size={64} className="text-green-500" />
        <h1 className="text-2xl font-bold text-foreground">App Installed!</h1>
        <p className="text-muted-foreground">Ujebong is installed on your device. Open it from your home screen.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-6 pt-14 text-center">
      <Smartphone size={64} className="text-primary" />
      <h1 className="text-2xl font-bold text-foreground">Install Ujebong</h1>
      <p className="max-w-sm text-muted-foreground">
        Install Ujebong on your phone for the best experience — fast loading, offline access, and works just like a native app.
      </p>

      {deferredPrompt ? (
        <Button size="lg" onClick={handleInstall} className="gap-2">
          <Download size={20} /> Install App
        </Button>
      ) : isIOS ? (
        <div className="rounded-xl border border-border bg-card p-4 text-left text-sm text-muted-foreground max-w-sm">
          <p className="font-semibold text-foreground mb-2">To install on iPhone/iPad:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Tap the <Share size={14} className="inline text-primary" /> Share button in Safari</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong></li>
          </ol>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-left text-sm text-muted-foreground max-w-sm">
          <p className="font-semibold text-foreground mb-2">To install on Android:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Tap the <MoreVertical size={14} className="inline text-primary" /> menu in your browser</li>
            <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default InstallPage;
