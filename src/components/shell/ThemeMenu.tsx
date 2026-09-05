import { useTranslation } from "react-i18next";
import { Check, Laptop, Moon, Palette, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLOR_PALETTES, useUIStore, type ColorPalette, type ThemeMode } from "@/store/ui";
import { cn } from "@/lib/utils";

const PALETTE_SWATCH: Record<ColorPalette, string> = {
  indigo: "oklch(0.44 0.15 262)",
  emerald: "oklch(0.52 0.15 155)",
  sunset: "oklch(0.58 0.2 25)",
  ocean: "oklch(0.55 0.13 220)",
};

const MODE_ICON: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Laptop,
};

export function ThemeMenu({ triggerClassName, asChild = true }: { triggerClassName?: string; asChild?: boolean }) {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, colorPalette, setColorPalette } = useUIStore();
  const ModeIcon = MODE_ICON[themeMode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={asChild}>
        {asChild ? (
          <button
            className={cn("glass grid h-9 w-9 place-items-center rounded-full", triggerClassName)}
            aria-label={t("theme.menu")}
          >
            <ModeIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className={cn("flex cursor-pointer items-center gap-2", triggerClassName)}>
            <ModeIcon className="h-4 w-4" />
            <span>{t("theme.menu")}</span>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-56 border-none">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <ModeIcon className="h-3.5 w-3.5" />
          {t("theme.mode")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="h-4 w-4" />
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="h-4 w-4" />
            {t("theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Laptop className="h-4 w-4" />
            {t("theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          {t("theme.palette")}
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 px-1 pb-1">
          {COLOR_PALETTES.map((p) => (
            <button
              key={p}
              onClick={() => setColorPalette(p)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                colorPalette === p && "bg-accent text-accent-foreground",
              )}
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60"
                style={{ backgroundColor: PALETTE_SWATCH[p] }}
              />
              <span className="truncate">{t(`theme.palettes.${p}`)}</span>
              {colorPalette === p && <Check className="ms-auto h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
