import { useEffect, useState } from "react";
import { ModalRoot } from "@/components/ui/modal-root";
import { Toaster } from "sonner";
import { useUIStore, type Locale } from "@/store/ui";
import "@/i18n";
import i18n from "@/i18n";

const PALETTE_META: Record<string, { light: string; dark: string }> = {
  indigo: { light: "#4f46e5", dark: "#0b1020" },
  emerald: { light: "#059669", dark: "#062018" },
  sunset: { light: "#e11d48", dark: "#1f0a10" },
  ocean: { light: "#0891b2", dark: "#04191d" },
};

function useSystemPrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return prefersDark;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const { locale, themeMode, colorPalette } = useUIStore();
  const systemPrefersDark = useSystemPrefersDark();
  const resolvedDark = themeMode === "system" ? systemPrefersDark : themeMode === "dark";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.toggle("dark", resolvedDark);
    html.dataset.theme = colorPalette;
    const meta = document.querySelector('meta[name="theme-color"]');
    const palette = PALETTE_META[colorPalette] ?? PALETTE_META.indigo;
    if (meta) meta.setAttribute("content", resolvedDark ? palette.dark : palette.light);
  }, [resolvedDark, colorPalette]);

  return (
    <>
      <ModalRoot />
      {children}
      <Toaster position="top-right" richColors closeButton theme={resolvedDark ? "dark" : "light"} />
    </>
  );
}

export type { Locale };
