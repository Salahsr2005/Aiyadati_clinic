import { useState } from "react";
import { Bell, LogOut, Menu, MoreVertical, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useUIStore, type Locale } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/api/authApi";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useClinicName, useClinicProfile } from "@/hooks/useClinicProfile";
import { InstallPWAButton } from "@/components/shell/InstallPWAButton";
import { ThemeMenu } from "@/components/shell/ThemeMenu";
import { RemoteImage } from "@/components/common/RemoteImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const locales: { code: Locale; label: string; flagUrl: string; alt: string }[] = [
  { code: "fr", label: "FR", flagUrl: "https://flagcdn.com/w40/fr.png", alt: "France" },
  { code: "ar", label: "AR", flagUrl: "https://flagcdn.com/w40/sa.png", alt: "Saudi Arabia" },
  { code: "en", label: "EN", flagUrl: "https://flagcdn.com/w40/gb.png", alt: "United Kingdom" },
];

export function Topbar() {
  const { t } = useTranslation();
  const { locale, setLocale, toggleSidebar } = useUIStore();
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: profile } = useClinicProfile();
  const clinicName = useClinicName();

  const onLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clear();
    navigate("/login", { replace: true });
  };

  const displayName = clinicName || profile?.nameFr || user?.name || "Clinic";
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 mx-2 mt-2 rounded-2xl px-2.5 py-2.5 sm:mx-4 sm:mt-4 sm:px-4">
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          onClick={toggleSidebar}
          className="glass grid h-9 w-9 shrink-0 place-items-center rounded-full md:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Full search bar */}
        <div
          onClick={() => setSearchOpen(true)}
          className="glass hidden max-w-xl min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-accent/40 min-[717px]:flex"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="w-full min-w-0 truncate select-none text-start text-sm text-muted-foreground">
            {t("shell.searchPlaceholder", { defaultValue: "Search appointments, doctors & walk-in patients..." })}
          </span>
          <kbd className="hidden shrink-0 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
            ⌘K
          </kbd>
        </div>

        {/* Icon-only search trigger for narrow screens */}
        <button
          onClick={() => setSearchOpen(true)}
          className="glass grid h-9 w-9 shrink-0 place-items-center rounded-full min-[717px]:hidden"
          aria-label={t("shell.searchAria", { defaultValue: "Search" })}
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="glass hidden items-center gap-1 rounded-full p-1 min-[717px]:flex">
            {locales.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className="relative h-7 min-w-9 rounded-full px-2 text-xs font-medium"
              >
                {locale === l.code && (
                  <motion.span
                    layoutId="lang-pill"
                    className="absolute inset-0 rounded-full bg-primary-500"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={l.code + locale}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className={`relative inline-flex items-center gap-1.5 ${
                      locale === l.code ? "text-primary-foreground font-bold" : "text-foreground/70 font-semibold"
                    }`}
                  >
                    <img
                      src={l.flagUrl}
                      alt={l.alt}
                      crossOrigin="anonymous"
                      className="h-3 w-4.5 rounded-[2px] object-cover border border-black/15 shadow-2xs shrink-0"
                    />
                    <span>{l.label}</span>
                  </motion.span>
                </AnimatePresence>
              </button>
            ))}
          </div>

          <div className="hidden min-[717px]:block">
            <ThemeMenu />
          </div>

          <div className="hidden min-[717px]:block">
            <InstallPWAButton compact />
          </div>

          <button
            className="glass relative hidden h-9 w-9 place-items-center rounded-full min-[717px]:grid"
            aria-label={t("shell.notifications", { defaultValue: "Notifications" })}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="glass grid h-9 w-9 place-items-center rounded-full min-[717px]:hidden"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass w-56 border-none">
              <div className="flex items-center justify-between px-2 py-1.5">
                {locales.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLocale(l.code)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                      locale === l.code ? "bg-primary-500 text-primary-foreground" : "text-foreground/70"
                    }`}
                  >
                    <img
                      src={l.flagUrl}
                      alt={l.alt}
                      crossOrigin="anonymous"
                      className="h-3 w-4.5 rounded-[2px] object-cover border border-black/15 shadow-2xs shrink-0"
                    />
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <ThemeMenu
                asChild={false}
                triggerClassName="px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground w-full"
              />
              <DropdownMenuItem className="gap-2">
                <InstallPWAButton compact={false} />
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Bell className="h-4 w-4" />
                {t("shell.notifications", { defaultValue: "Notifications" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="glass flex items-center gap-2 rounded-full py-1 pe-2 ps-1 sm:pe-3">
            {profile?.logoUrl ? (
              <RemoteImage src={profile.logoUrl} alt={displayName} className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-500 text-xs font-bold text-primary-foreground">
                {initials}
              </div>
            )}
            <div className="hidden text-xs min-[900px]:block">
              <div className="font-medium leading-tight truncate max-w-[120px]">{displayName}</div>
              <div className="leading-tight text-muted-foreground text-[10px]">{t("shell.clinicRole", { defaultValue: "Clinic Portal" })}</div>
            </div>
            <button onClick={onLogout} aria-label={t("common.logout", { defaultValue: "Log out" })} className="ms-1 rounded-full p-1 hover:bg-accent cursor-pointer">
              <LogOut className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
            </button>
          </div>
        </div>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
