import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CopyReferenceButtonProps {
  value?: string | null;
  label?: string;
  className?: string;
}

export function CopyReferenceButton({
  value,
  label = "Copy Ref",
  className = "",
}: CopyReferenceButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Reference copied to clipboard", {
        description: value,
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy reference");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy reference ID: ${value}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-2 py-1 text-[10px] font-bold font-mono text-muted-foreground hover:bg-muted/40 hover:text-foreground transition cursor-pointer ${className}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 text-primary-500" />
      )}
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}
