import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { BottomNav } from "@/components/shell/BottomNav";
import logo from "@/assets/logo.svg";
import { useAuthStore } from "@/store/auth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTranslation } from "react-i18next";

/**
 * Clinic portal gate. Guards all clinic-role routes and renders the portal shell.
 */
export default function ClinicPortalLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const online = useOnlineStatus();

  useEffect(() => {
    if (hydrated && !token) {
      navigate("/login", { replace: true });
    }
  }, [hydrated, token, navigate]);

  if (!hydrated || !token) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={logo} alt="Iyadati Clinic" className="h-12 w-12 object-contain" />
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {!online && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            {t("shell.offline.message", { defaultValue: "You are currently offline" })}
          </div>
        )}
        <main className="min-w-0 flex-1 p-4 pb-24 md:pb-4">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
