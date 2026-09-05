import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TimePillPickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
}

export function TimePillPicker({
  value,
  onChange,
  label,
  className,
}: TimePillPickerProps) {
  const options = useMemo(() => {
    const list: string[] = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        list.push(`${hh}:${mm}`);
      }
    }
    return list;
  }, []);

  return (
    <div className={className}>
      {label && <label className="text-xs font-semibold text-muted-foreground block mb-2">{label}</label>}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto custom-scrollbar p-1">
        {options.map((timeStr) => {
          const isSelected = value === timeStr;
          return (
            <button
              key={timeStr}
              type="button"
              onClick={() => onChange(timeStr)}
              className={cn(
                "rounded-xl px-2.5 py-1.5 text-xs font-bold transition duration-200 cursor-pointer border text-center",
                isSelected
                  ? "bg-primary-500 text-primary-foreground border-primary-500 shadow-sm"
                  : "bg-accent/40 border-border/50 text-foreground hover:bg-accent/80 hover:border-primary-500/40",
              )}
            >
              {timeStr}
            </button>
          );
        })}
      </div>
    </div>
  );
}
