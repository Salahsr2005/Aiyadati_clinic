import { cn } from "@/lib/utils";

export function FilterChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T | undefined; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="glass inline-flex items-center gap-1 rounded-full p-1 text-xs">
      {options.map((o) => (
        <button
          key={String(o.value ?? "all")}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1 transition",
            value === o.value ? "bg-primary-500 text-white" : "text-foreground/70 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}