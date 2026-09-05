import { CheckCircle2, MapPin, Phone, ShieldOff } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { UserAvatar } from "@/components/users/UserAvatar";
import { TrustLevelBadge } from "@/components/data/TrustLevelBadge";
import type { UserRow } from "@/api/usersApi";
import type { WilayaLite } from "@/hooks/useWilayas";
import type { Locale } from "@/store/ui";

export function UserCard({
  user,
  wilaya,
  locale,
  onClick,
}: {
  user: UserRow;
  wilaya?: WilayaLite;
  locale: Locale;
  onClick?: () => void;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const wilayaName = wilaya
    ? locale === "ar"
      ? wilaya.nameAr || wilaya.nameFr
      : wilaya.nameFr || wilaya.nameAr
    : undefined;
  return (
    <GlassCard
      onClick={onClick}
      className="cursor-pointer p-4 transition hover:scale-[1.01] hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <UserAvatar url={user.avatarUrl} first={user.firstName} last={user.lastName} email={user.email} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{fullName}</div>
            {user.isVerified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          {user.phone && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {user.phone}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TrustLevelBadge level={user.trustLevel} points={user.trustPoints} />
        {user.isSuspended ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">
            <ShieldOff className="h-3 w-3" />
            Suspended
          </span>
        ) : user.isVerified ? (
          <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            Verified
          </span>
        ) : (
          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Unverified
          </span>
        )}
        {wilayaName && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-foreground/80">
            <MapPin className="h-3 w-3" />
            {wilayaName}
          </span>
        )}
        {(user.noShowCount ?? 0) > 0 && (
          <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            No-shows: {user.noShowCount}
          </span>
        )}
      </div>

      <div className="mt-3 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
        Joined {new Date(user.createdAt).toLocaleDateString()}
      </div>
    </GlassCard>
  );
}