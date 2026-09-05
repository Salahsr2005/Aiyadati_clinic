import { useState } from "react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api";

/**
 * Resolves a possibly-relative media path (photoUrl/logoUrl/…) returned by the
 * API into an absolute URL the browser can load.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function UserAvatar({
  url,
  first,
  last,
  email,
  size = "md",
}: {
  url?: string | null;
  first?: string | null;
  last?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [errored, setErrored] = useState(false);
  const dim = { sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-sm", xl: "h-20 w-20 text-base" }[size];
  const initials =
    ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() ||
    (email?.[0]?.toUpperCase() ?? "?");
  const resolved = resolveMediaUrl(url);

  if (resolved && !errored) {
    return (
      <img
        src={resolved}
        crossOrigin="anonymous"
        alt=""
        onError={() => setErrored(true)}
        className={cn(dim, "rounded-full object-cover ring-1 ring-border")}
      />
    );
  }
  return (
    <div className={cn(dim, "grid place-items-center rounded-full bg-primary-500 font-semibold text-primary-foreground")}>
      {initials}
    </div>
  );
}
