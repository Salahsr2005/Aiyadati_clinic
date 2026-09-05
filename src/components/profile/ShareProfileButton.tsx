import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareProfileButton({ doctorId, name }: { doctorId?: string; name?: string }) {
  const [copied, setCopied] = useState(false);
  const publicUrl =
    typeof window !== "undefined" && doctorId
      ? `${window.location.origin}/doctors/${doctorId}`
      : undefined;

  const handleShare = async () => {
    if (!publicUrl) return;
    const shareData = {
      title: name ? `Dr. ${name} — Iyadati` : "Doctor profile — Iyadati",
      text: "View my public profile on Iyadati.",
      url: publicUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Profile link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={!publicUrl}
      className="glass inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Share profile"}
    </button>
  );
}
