import { useState, useEffect } from "react";
import { Clock, Check, X } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { cn } from "@/lib/utils";

interface ModernTimePickerModalProps {
  value: string; // "HH:MM" e.g. "09:30"
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const QUICK_PRESETS = [
  "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

export function ModernTimePickerModal({
  value,
  onChange,
  label,
  placeholder = "Select time",
  className,
  disabled = false,
}: ModernTimePickerModalProps) {
  const [open, setOpen] = useState(false);

  // Parse initial HH:MM
  const parseTime = (val?: string) => {
    if (!val || !val.includes(":")) return { h: "09", m: "00" };
    const [h, m] = val.split(":");
    return {
      h: String(parseInt(h, 10) || 0).padStart(2, "0"),
      m: String(Math.floor((parseInt(m, 10) || 0) / 5) * 5).padStart(2, "0"),
    };
  };

  const initial = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(initial.h);
  const [selectedMinute, setSelectedMinute] = useState(initial.m);

  useEffect(() => {
    const parsed = parseTime(value);
    setSelectedHour(parsed.h);
    setSelectedMinute(parsed.m);
  }, [value, open]);

  const currentTimeFormatted = `${selectedHour}:${selectedMinute}`;

  const handleApply = (timeStr?: string) => {
    const finalTime = timeStr || currentTimeFormatted;
    onChange(finalTime);
    setOpen(false);
  };

  return (
    <div className={cn("inline-block", className)}>
      {label && <label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-bold font-mono text-foreground transition hover:border-primary-500/50 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50",
          !value && "text-muted-foreground font-sans font-normal"
        )}
      >
        <Clock className="h-3.5 w-3.5 text-primary-500 shrink-0" />
        <span>{value || placeholder}</span>
      </button>

      {/* Clock Modal Portal */}
      <ModalPortal id="modern-time-picker-modal" open={open} onClose={() => setOpen(false)}>
        <div
          className="glass relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/40 bg-card p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-500/10 text-primary-500">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Select Time</h4>
                <p className="text-[10px] text-muted-foreground">Pick a consultation time slot</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Time Display Badge */}
          <div className="flex items-center justify-center p-3 rounded-2xl bg-primary-500/10 border border-primary-500/20 text-center">
            <span className="text-3xl font-extrabold font-mono text-primary-500 tracking-wider">
              {selectedHour}:{selectedMinute}
            </span>
          </div>

          {/* Quick Presets Grid */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Quick Presets
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_PRESETS.map((preset) => {
                const isActive = value === preset || currentTimeFormatted === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const [h, m] = preset.split(":");
                      setSelectedHour(h);
                      setSelectedMinute(m);
                      handleApply(preset);
                    }}
                    className={cn(
                      "rounded-xl border py-1.5 px-2 text-[11px] font-mono font-bold transition text-center",
                      isActive
                        ? "border-primary-500 bg-primary-500 text-primary-foreground shadow-xs"
                        : "border-border/40 hover:bg-muted/30 text-foreground"
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour & Minute Pickers */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
            {/* Hours Picker */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block text-center">
                Hour
              </label>
              <div className="h-32 overflow-y-auto custom-scrollbar rounded-2xl border border-border/30 bg-muted/10 p-1 space-y-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    className={cn(
                      "w-full py-1 rounded-xl text-xs font-mono font-bold transition text-center",
                      selectedHour === h
                        ? "bg-primary-500 text-primary-foreground"
                        : "hover:bg-muted/30 text-foreground"
                    )}
                  >
                    {h}:00
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Picker */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block text-center">
                Minute
              </label>
              <div className="h-32 overflow-y-auto custom-scrollbar rounded-2xl border border-border/30 bg-muted/10 p-1 space-y-1">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMinute(m)}
                    className={cn(
                      "w-full py-1 rounded-xl text-xs font-mono font-bold transition text-center",
                      selectedMinute === m
                        ? "bg-primary-500 text-primary-foreground"
                        : "hover:bg-muted/30 text-foreground"
                    )}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border/40 px-3.5 py-1.5 text-xs font-bold hover:bg-muted/20 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleApply()}
              className="inline-flex items-center gap-1 rounded-xl bg-primary-500 px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-600 transition"
            >
              <Check className="h-3.5 w-3.5" /> Set {currentTimeFormatted}
            </button>
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}
