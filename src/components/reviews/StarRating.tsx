import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a row of 5 stars representing a rating value, supporting
 * filled / half / empty states. Used for both per-review and aggregate
 * ratings across the doctor portal.
 */
export function StarRating({
  value,
  size = "h-4 w-4",
  className,
}: {
  value: number;
  size?: string;
  className?: string;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${safeValue.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const diff = safeValue - (i - 1);
        if (diff >= 1) {
          return <Star key={i} className={cn(size, "fill-warning text-warning")} />;
        }
        if (diff >= 0.25) {
          return <StarHalf key={i} className={cn(size, "fill-warning text-warning")} />;
        }
        return <Star key={i} className={cn(size, "text-muted-foreground/30 fill-none")} />;
      })}
    </div>
  );
}
