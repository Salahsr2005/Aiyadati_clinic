import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarRange,
  Stethoscope,
  LayoutList,
  DoorOpen,
  Users,
  Image,
  Star,
  Building2,
  ChevronLeft,
  X,
  type LucideIcon,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { useTranslation } from "react-i18next";

export interface NavItem {
  to: string;
  label: string;
  i18nKey?: string;
  icon: LucideIcon;
}

export const clinicNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", i18nKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/appointments", label: "Appointments", i18nKey: "nav.appointments", icon: CalendarClock },
  { to: "/schedule", label: "Doctor slots", i18nKey: "nav.schedule", icon: CalendarRange },
  { to: "/doctors", label: "Doctors", i18nKey: "nav.doctors", icon: Stethoscope },
  { to: "/services", label: "Services", i18nKey: "nav.services", icon: LayoutList },
  { to: "/rooms", label: "Rooms", i18nKey: "nav.rooms", icon: DoorOpen },
  { to: "/patients", label: "Guest patients", i18nKey: "nav.patients", icon: Users },
  { to: "/gallery", label: "Gallery", i18nKey: "nav.gallery", icon: Image },
  { to: "/reviews", label: "Reviews", i18nKey: "nav.reviews", icon: Star },
  { to: "/profile", label: "Clinic profile", i18nKey: "nav.profile", icon: Building2 },
];

export function Sidebar({ items = clinicNavItems }: { items?: NavItem[] }) {
  const { t } = useTranslation();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const location = useLocation();
  const pathname = location.pathname;
  const { pendingCount } = useClinicDoctors();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="glass sticky top-0 hidden h-screen shrink-0 overflow-hidden rounded-none border-y-0 border-l-0 md:block rtl:border-l rtl:border-r-0 z-30"
      >
        <div className="flex h-full flex-col p-3">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden">
              <img src={logo} alt="Iyadati" className="h-9 w-9 object-contain drop-shadow-sm" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight text-foreground">Iyadati</div>
                <div className="truncate text-[11px] text-muted-foreground">{t("app.clinicName", { defaultValue: "Clinic Portal" })}</div>
              </div>
            )}
          </div>

          <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
            {items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              const itemLabel = item.i18nKey ? t(item.i18nKey, { defaultValue: item.label }) : item.label;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? itemLabel : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-primary-500/12 font-bold text-primary-500 shadow-xs"
                      : "text-foreground/80 hover:bg-accent/60",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-y-2 start-0 w-1 rounded-full bg-primary-500"
                    />
                  )}
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed && <span className="truncate">{itemLabel}</span>}
                  {item.to === "/doctors" && pendingCount > 0 && (
                    <span
                      className={cn(
                        "grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-danger-foreground",
                        collapsed ? "absolute end-1 top-1" : "ms-auto",
                      )}
                    >
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={toggle}
            className="glass mt-2 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            aria-label={t("shell.sidebar.collapseAria", { defaultValue: "Toggle sidebar" })}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>{t("shell.sidebar.collapse", { defaultValue: "Collapse" })}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {!collapsed && (
          <div className="fixed inset-0 z-[9999] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggle}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-y-0 start-0 w-72 bg-popover text-popover-foreground border-r border-border p-4 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between px-2 pb-4 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="Iyadati" className="h-9 w-9 object-contain" />
                    <div>
                      <div className="text-sm font-bold text-foreground">Iyadati</div>
                      <div className="text-[11px] text-muted-foreground">{t("shell.sidebar.clinicPortalName", { defaultValue: "Clinic Portal" })}</div>
                    </div>
                  </div>
                  <button
                    onClick={toggle}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1.5 overflow-y-auto max-h-[70vh] custom-scrollbar">
                  {items.map((item) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    const Icon = item.icon;
                    const itemLabel = item.i18nKey ? t(item.i18nKey, { defaultValue: item.label }) : item.label;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={toggle}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition",
                          active
                            ? "bg-primary-500 text-primary-foreground shadow-md"
                            : "text-foreground/80 hover:bg-accent/60",
                        )}
                      >
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        <span className="truncate">{itemLabel}</span>
                        {item.to === "/doctors" && pendingCount > 0 && (
                          <span className="ms-auto grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-danger-foreground">
                            {pendingCount > 9 ? "9+" : pendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-border/40 text-center text-[10px] text-muted-foreground font-medium">
                {t("shell.sidebar.footer", { defaultValue: "Iyadati Healthcare Systems © 2026" })}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
