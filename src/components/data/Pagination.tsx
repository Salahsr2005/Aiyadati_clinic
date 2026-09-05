import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SelectMenu } from "@/components/data/SelectMenu";

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  onLimit,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  onLimit?: (n: number) => void;
}) {
  const { t } = useTranslation();
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
      <div>
        {t("table.showing", { defaultValue: "Showing" })} <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span>{" "}
        {t("table.of", { defaultValue: "of" })} <span className="font-medium text-foreground">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        {onLimit && (
          <SelectMenu
            value={String(limit)}
            onChange={(v) => onLimit(Number(v ?? limit))}
            options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: `${n} / page` }))}
            className="min-w-[6rem]"
          />
        )}
        <button
          disabled={!canPrev}
          onClick={() => onPage(page - 1)}
          className={cn("glass grid h-8 w-8 place-items-center rounded-full", !canPrev && "opacity-40")}
          aria-label="prev"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        <span className="tabular-nums">
          {page} / {Math.max(1, totalPages)}
        </span>
        <button
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          className={cn("glass grid h-8 w-8 place-items-center rounded-full", !canNext && "opacity-40")}
          aria-label="next"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}