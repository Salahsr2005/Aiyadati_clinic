import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/queryClient";
import { CalendarClock, LayoutDashboard, Search, User } from "lucide-react";
import { clinicAppointmentsApi } from "@/api/clinicAppointmentsApi";
import { useTranslation } from "react-i18next";
import { clinicNavItems } from "@/components/shell/Sidebar";
import { qk } from "@/lib/queryKeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const { data } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 50 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 50 }),
    enabled: open,
    staleTime: 30_000,
  });

  const term = q.trim().toLowerCase();

  const navMatches = useMemo(
    () =>
      clinicNavItems
        .filter((i) => {
          const label = i.i18nKey ? t(i.i18nKey, { defaultValue: i.label }) : i.label;
          return !term || label.toLowerCase().includes(term);
        })
        .slice(0, 5),
    [term, t],
  );

  const apptMatches = useMemo(() => {
    const items = data?.data ?? [];
    if (!term) return items.slice(0, 5);
    return items
      .filter((a) => {
        const name = (
          a.patient
            ? `${a.patient.firstName || ""} ${a.patient.lastName || ""}`
            : a.guestPatient
              ? `${a.guestPatient.firstName} ${a.guestPatient.lastName}`
              : "Patient"
        ).toLowerCase();
        return name.includes(term) || (a.notes ?? "").toLowerCase().includes(term);
      })
      .slice(0, 6);
  }, [data, term]);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/40 p-4 pt-24 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="glass w-full max-w-lg overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("shell.commandPalette.placeholder", { defaultValue: "Search pages, appointments..." })}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {navMatches.length > 0 && (
            <div className="mb-1">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("shell.commandPalette.pages", { defaultValue: "Pages" })}
              </div>
              {navMatches.map((i) => (
                <button
                  key={i.to}
                  onClick={() => go(i.to)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent/60 cursor-pointer"
                >
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  {i.i18nKey ? t(i.i18nKey, { defaultValue: i.label }) : i.label}
                </button>
              ))}
            </div>
          )}

          {apptMatches.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("shell.commandPalette.appointments", { defaultValue: "Appointments" })}
              </div>
              {apptMatches.map((a) => {
                const name = a.patient
                  ? `${a.patient.firstName || ""} ${a.patient.lastName || ""}`
                  : a.guestPatient
                    ? `${a.guestPatient.firstName} ${a.guestPatient.lastName}`
                    : "Patient";
                return (
                  <button
                    key={a.id}
                    onClick={() => go("/appointments")}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent/60 cursor-pointer"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{name}</span>
                    <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {a.slot?.date ?? ""} {a.slot?.startTime ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {navMatches.length === 0 && apptMatches.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("shell.commandPalette.noResults", { defaultValue: "No results found" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
