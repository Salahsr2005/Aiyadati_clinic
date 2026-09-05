import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { clinicNavItems } from "@/components/shell/Sidebar";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";

const tabs = clinicNavItems.slice(0, 4);

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { pendingCount } = useClinicDoctors();

  return (
    <nav
      className="glass fixed inset-x-2 bottom-2 z-40 flex items-center justify-around rounded-2xl px-1 py-1.5 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.375rem)" }}
    >
      {tabs.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        const label = item.i18nKey ? t(item.i18nKey, { defaultValue: item.label }) : item.label;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition",
              active ? "text-primary-500" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}

      <button
        onClick={toggleSidebar}
        className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold text-muted-foreground transition cursor-pointer"
        aria-label={t("nav.more", { defaultValue: "More" })}
      >
        <span className="relative">
          <MoreHorizontal className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -end-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-danger-foreground">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </span>
        <span className="truncate">{t("nav.more", { defaultValue: "More" })}</span>
      </button>
    </nav>
  );
}
