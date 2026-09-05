import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Gift,
  Hash,
  History,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  User as UserIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { Drawer } from "@/components/data/Drawer";
import { FormModal } from "@/components/data/FormModal";
import { UserAvatar } from "@/components/users/UserAvatar";
import { TrustLevelBadge } from "@/components/data/TrustLevelBadge";
import { Skeleton } from "@/components/glass/Skeleton";
import { appointmentsApi } from "@/api/appointmentsApi";
import { walletApi } from "@/api/walletApi";
import { usersApi, type UserRow } from "@/api/usersApi";
import { useWilayaMap } from "@/hooks/useWilayas";
import { resolveWilaya } from "@/lib/displayField";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
  copyable?: string;
}) {
  return (
    <div className="group flex items-start gap-3 py-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/40 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
      {copyable && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(copyable);
            toast.success(`${label} copied`);
          }}
          className="opacity-0 transition group-hover:opacity-100"
          aria-label={`copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
}) {
  const toneCls = {
    default: "border-border bg-muted/20 text-foreground",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/30 bg-danger/10 text-danger",
    primary: "border-primary-500/30 bg-primary-500/10 text-primary-500",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-3", toneCls)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
        {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

type TabKey = "overview" | "appointments" | "wallet" | "risk";

export function UserDetailDrawer({
  user,
  open,
  onClose,
}: {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { locale } = useUIStore();
  const { map: wilayaMap } = useWilayaMap();
  const currentAdmin = useAuthStore((s) => s.user);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [unsuspendOpen, setUnsuspendOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [credits, setCredits] = useState<number>(10);
  const [creditReason, setCreditReason] = useState("");
  const [tab, setTab] = useState<TabKey>("overview");

  const walletQ = useQuery({
    queryKey: ["user-wallet", user?.id],
    queryFn: () => usersApi.getWallet(user!.id),
    enabled: !!user && open,
    retry: false,
  });

  const apptsQ = useQuery({
    queryKey: ["user-appointments", user?.id],
    queryFn: () =>
      appointmentsApi.list({ patientId: user!.id, limit: 25, sortBy: "createdAt", sortOrder: "desc" }),
    enabled: !!user && open && (tab === "appointments" || tab === "overview"),
    retry: false,
  });

  const txQ = useQuery({
    queryKey: ["user-tx", user?.id],
    queryFn: () =>
      walletApi.getTransactions({ userId: user!.id, limit: 20, sortBy: "createdAt", sortOrder: "desc" }),
    enabled: !!user && open && tab === "wallet",
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["user-wallet", user?.id] });
    qc.invalidateQueries({ queryKey: ["user-tx", user?.id] });
  };

  const suspend = useMutation({
    mutationFn: (r: string) => usersApi.suspend(user!.id, r),
    onSuccess: () => {
      toast.success("User suspended");
      invalidate();
      setSuspendOpen(false);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unsuspend = useMutation({
    mutationFn: () => usersApi.unsuspend(user!.id),
    onSuccess: () => {
      toast.success("User reinstated");
      invalidate();
      setUnsuspendOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const grant = useMutation({
    mutationFn: () => usersApi.grantCredits(user!.id, credits, creditReason || undefined),
    onSuccess: () => {
      toast.success(`Granted ${credits} credits`);
      invalidate();
      setGrantOpen(false);
      setCredits(10);
      setCreditReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apptStats = useMemo(() => {
    const items = apptsQ.data?.items ?? [];
    const total = items.length;
    const completed = items.filter((a) => (a.status ?? "").toUpperCase() === "COMPLETED").length;
    const cancelled = items.filter((a) => (a.status ?? "").toUpperCase() === "CANCELLED").length;
    const noShow = items.filter((a) => (a.status ?? "").toUpperCase() === "NO_SHOW").length;
    const upcoming = items.filter((a) =>
      ["PENDING", "CONFIRMED"].includes((a.status ?? "").toUpperCase()),
    ).length;
    return { total, completed, cancelled, noShow, upcoming };
  }, [apptsQ.data]);

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const wilayaName = resolveWilaya(user.wilayaId, wilayaMap, locale, user.wilaya);

  const wallet = walletQ.data as { balance?: number; credits?: number; freeCredits?: number } | undefined;
  const balance = wallet?.balance ?? wallet?.credits ?? 0;

  const accountAgeDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000),
  );

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: UserIcon },
    { key: "appointments", label: "Appointments", icon: Calendar },
    { key: "wallet", label: "Wallet", icon: WalletIcon },
    { key: "risk", label: "Risk & Trust", icon: Activity },
  ];

  return (
    <>
      <Drawer
        id={`user-drawer-${user.id}`}
        open={open}
        onClose={onClose}
        title={fullName}
        subtitle={user.email}
        width="max-w-2xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.id);
                  toast.success("User ID copied");
                }}
                className="glass inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] hover:bg-accent"
              >
                <Hash className="h-3 w-3" /> ID
              </button>
              <Link
                to="/appointments"
                search={{ patientId: user.id } as never}
                className="glass inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] hover:bg-accent"
                onClick={onClose}
              >
                <ExternalLink className="h-3 w-3" /> Appointments
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentAdmin?.role === "SUPER_ADMIN" && (
                <button
                  onClick={() => setGrantOpen(true)}
                  className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  <Coins className="h-4 w-4" /> Grant credits
                </button>
              )}
              {user.isSuspended ? (
                <button
                  onClick={() => setUnsuspendOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-success px-3 py-2 text-xs font-medium text-white shadow"
                >
                  <ShieldCheck className="h-4 w-4" /> Reinstate
                </button>
              ) : (
                <button
                  onClick={() => setSuspendOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-danger px-3 py-2 text-xs font-medium text-white shadow"
                >
                  <ShieldOff className="h-4 w-4" /> Suspend
                </button>
              )}
            </div>
          </div>
        }
      >
        {/* Hero header */}
        <div className="flex items-start gap-4">
          <UserAvatar url={user.avatarUrl} first={user.firstName} last={user.lastName} email={user.email} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <TrustLevelBadge level={user.trustLevel} points={user.trustPoints} />
              {user.isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Unverified
                </span>
              )}
              {user.isSuspended && (
                <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger">
                  <ShieldOff className="h-3 w-3" /> Suspended
                </span>
              )}
              <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                {accountAgeDays}d old
              </span>
            </div>
            {user.suspensionReason && (
              <div className="mt-2 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger">
                <span className="font-medium">Suspension reason:</span> {user.suspensionReason}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-muted/30 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === t.key
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Trust" value={`L${user.trustLevel ?? 0}`} tone="primary" icon={ShieldCheck} />
                <StatTile label="Points" value={user.trustPoints ?? 0} icon={TrendingUp} />
                <StatTile
                  label="No-shows"
                  value={user.noShowCount ?? 0}
                  tone={(user.noShowCount ?? 0) > 2 ? "danger" : (user.noShowCount ?? 0) > 0 ? "warning" : "success"}
                />
                <StatTile label="Wallet" value={balance} tone="success" icon={Coins} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="glass rounded-2xl p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact
                  </div>
                  <InfoRow icon={Mail} label="Email" value={user.email} copyable={user.email} />
                  <InfoRow icon={Phone} label="Phone" value={user.phone} copyable={user.phone || undefined} />
                  <InfoRow icon={MapPin} label="Wilaya" value={wilayaName} />
                </div>
                <div className="glass rounded-2xl p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Profile
                  </div>
                  <InfoRow icon={UserIcon} label="Full name" value={fullName} />
                  <InfoRow
                    icon={Calendar}
                    label="Date of birth"
                    value={user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : undefined}
                  />
                  <InfoRow icon={Calendar} label="Joined" value={new Date(user.createdAt).toLocaleString()} />
                </div>
                <div className="glass col-span-full rounded-2xl p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Appointment activity</span>
                    <History className="h-3.5 w-3.5" />
                  </div>
                  {apptsQ.isLoading ? (
                    <Skeleton className="h-12 w-full rounded-xl" />
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <StatTile label="Total" value={apptStats.total} />
                      <StatTile label="Upcoming" value={apptStats.upcoming} tone="primary" />
                      <StatTile label="Done" value={apptStats.completed} tone="success" />
                      <StatTile label="Cancelled" value={apptStats.cancelled} tone="warning" />
                      <StatTile label="No-show" value={apptStats.noShow} tone="danger" />
                    </div>
                  )}
                </div>
                <div className="glass col-span-full rounded-2xl p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Identifiers
                  </div>
                  <div className="grid gap-1 font-mono text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">id: {user.id}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.id);
                          toast.success("ID copied");
                        }}
                        className="hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {user.wilayaId && <div>wilayaId: {user.wilayaId}</div>}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "appointments" && (
            <div className="space-y-2">
              {apptsQ.isLoading ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : apptsQ.error ? (
                <div className="text-xs text-muted-foreground">Unable to load appointments</div>
              ) : (apptsQ.data?.items ?? []).length === 0 ? (
                <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                  No appointments yet
                </div>
              ) : (
                (apptsQ.data?.items ?? []).map((a) => {
                  const st = (a.status ?? "PENDING").toUpperCase();
                  const tone =
                    st === "COMPLETED"
                      ? "text-success bg-success/10 border-success/30"
                      : st === "CANCELLED"
                        ? "text-warning bg-warning/10 border-warning/30"
                        : st === "NO_SHOW"
                          ? "text-danger bg-danger/10 border-danger/30"
                          : "text-primary-500 bg-primary-500/10 border-primary-500/30";
                  return (
                    <div key={a.id} className="glass rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                            tone,
                          )}
                        >
                          {st.replace("_", " ").toLowerCase()}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                      {a.slot?.date && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {a.slot.date} · {a.slot.startTime}–{a.slot.endTime}
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        {a.type && (
                          <span className="capitalize text-primary-500">
                            {String(a.type).replace("_", " ").toLowerCase()}
                          </span>
                        )}
                        {a.paymentMethod && (
                          <span className="text-muted-foreground">
                            · {String(a.paymentMethod).replace("_", " ").toLowerCase()}
                          </span>
                        )}
                        {typeof a.amount === "number" && (
                          <span className="ms-auto font-medium tabular-nums">{a.amount} DZD</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "wallet" && (
            <div className="space-y-3">
              <div className="glass grid grid-cols-3 gap-2 rounded-2xl p-3">
                <StatTile label="Balance" value={balance} tone="success" icon={Coins} />
                <StatTile label="Free" value={wallet?.freeCredits ?? 0} icon={Gift} />
                <StatTile
                  label="Transactions"
                  value={txQ.data?.total ?? "—"}
                  icon={History}
                />
              </div>
              <div className="glass rounded-2xl p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent transactions
                </div>
                {txQ.isLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : txQ.error ? (
                  <div className="text-xs text-muted-foreground">
                    Transactions endpoint unavailable
                  </div>
                ) : (txQ.data?.items ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No transactions</div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {(txQ.data?.items ?? []).map((t) => {
                      const amt = t.amount ?? t.credits ?? 0;
                      const pos = amt >= 0;
                      return (
                        <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium capitalize">
                              {(t.type ?? "transaction").replace(/_/g, " ").toLowerCase()}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {t.description || t.reason || t.paymentProvider || "—"}
                            </div>
                          </div>
                          <div className="text-end">
                            <div
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                pos ? "text-success" : "text-danger",
                              )}
                            >
                              {pos ? "+" : ""}
                              {amt}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "risk" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatTile
                  label="Trust level"
                  value={`L${user.trustLevel ?? 0}`}
                  tone={(user.trustLevel ?? 0) >= 4 ? "success" : (user.trustLevel ?? 0) >= 2 ? "primary" : "warning"}
                />
                <StatTile label="Trust points" value={user.trustPoints ?? 0} icon={TrendingUp} />
                <StatTile
                  label="No-shows"
                  value={user.noShowCount ?? 0}
                  tone={(user.noShowCount ?? 0) > 2 ? "danger" : (user.noShowCount ?? 0) > 0 ? "warning" : "success"}
                />
                <StatTile
                  label="Verified"
                  value={user.isVerified ? "Yes" : "No"}
                  tone={user.isVerified ? "success" : "warning"}
                />
                <StatTile
                  label="Suspended"
                  value={user.isSuspended ? "Yes" : "No"}
                  tone={user.isSuspended ? "danger" : "success"}
                />
                <StatTile label="Account age" value={`${accountAgeDays}d`} icon={Calendar} />
              </div>
              {user.suspendedAt && (
                <div className="glass rounded-2xl p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suspension history
                  </div>
                  <div className="mt-1 text-sm">
                    Since{" "}
                    <span className="font-medium">
                      {new Date(user.suspendedAt).toLocaleString()}
                    </span>
                  </div>
                  {user.suspensionReason && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reason: {user.suspensionReason}
                    </div>
                  )}
                </div>
              )}
              <div className="glass rounded-2xl p-3 text-[11px] text-muted-foreground">
                Risk signals are derived from trust points, no-show count, and verification state.
                Deeper signals (device fingerprints, IP history) will surface here once the audit
                endpoints are exposed.
              </div>
            </div>
          )}
        </div>
      </Drawer>

      <FormModal
        id="user-suspend-modal"
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title={`Suspend ${fullName}`}
        description="Provide a reason (visible to the user)."
        footer={
          <>
            <button onClick={() => setSuspendOpen(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              disabled={suspend.isPending || reason.trim().length < 3}
              onClick={() => suspend.mutate(reason.trim())}
              className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-60"
            >
              {suspend.isPending ? "Suspending…" : "Suspend"}
            </button>
          </>
        }
      >
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for suspension"
          rows={4}
          className="w-full rounded-xl border border-input bg-background/50 p-3 text-sm outline-none focus:border-primary-500"
        />
      </FormModal>

      <ConfirmDialog
        id="user-unsuspend-modal"
        open={unsuspendOpen}
        onClose={() => setUnsuspendOpen(false)}
        onConfirm={async () => {
          await unsuspend.mutateAsync();
        }}
        title="Reinstate user"
        description="Restore full access."
        confirmLabel={unsuspend.isPending ? "Working…" : "Reinstate"}
      />

      <FormModal
        id="user-grant-modal"
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant credits"
        description="Free credits added to this user's wallet."
        footer={
          <>
            <button onClick={() => setGrantOpen(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              disabled={grant.isPending || credits < 1 || credits > 1000}
              onClick={() => grant.mutate()}
              className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-60"
            >
              {grant.isPending ? "Granting…" : "Grant"}
            </button>
          </>
        }
      >
        <label className="block text-xs text-muted-foreground">
          Amount (1–1000)
          <input
            type="number"
            min={1}
            max={1000}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">
          Reason (optional)
          <input
            value={creditReason}
            onChange={(e) => setCreditReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
        </label>
      </FormModal>
    </>
  );
}
