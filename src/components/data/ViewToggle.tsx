import { LayoutGrid, List, Kanban, Map as MapIcon, Globe2, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "table" | "kanban" | "wilaya" | "map" | "heatmap";

const ICONS = {
  grid: LayoutGrid,
  table: List,
  kanban: Kanban,
  wilaya: MapIcon,
  map: Globe2,
  heatmap: Flame,
} as const;

export function ViewToggle({
  value,
  onChange,
  modes = ["grid", "table"],
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  modes?: ViewMode[];
}) {
  const { t } = useTranslation();
  const labels: Record<ViewMode, string> = {
    grid: t("views.grid"),
    table: t("views.table"),
    kanban: t("views.kanban"),
    wilaya: t("views.byWilaya"),
    map: t("views.map"),
    heatmap: t("views.heatmap", "Heatmap"),
  };
  return (
    <div className="glass inline-flex items-center rounded-full p-1 text-xs">
      {modes.map((m) => {
        const Icon = ICONS[m];
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 transition",
              value === m ? "bg-primary-500 text-white" : "text-foreground/70 hover:text-foreground",
            )}
            aria-label={`${m} view`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{labels[m]}</span>
          </button>
        );
      })}
    </div>
  );
}