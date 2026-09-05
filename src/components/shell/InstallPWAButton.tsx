import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Install-to-home-screen button. Renders only when the browser offers installation. */
export function InstallPWAButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setDeferred(null);
    }
  };

  if (compact) {
    return (
      <button
        onClick={install}
        aria-label={t("shell.install.installApp")}
        title={t("shell.install.installApp")}
        className="glass grid h-9 w-9 place-items-center rounded-full"
      >
        <Download className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={install}
      className="glass inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
    >
      <Download className="h-3.5 w-3.5" />
      {t("shell.install.installApp")}
    </button>
  );
}
