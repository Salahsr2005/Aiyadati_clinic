import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function GlassCard({
  className,
  children,
  strong,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-3xl p-5 relative",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}