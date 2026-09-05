import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export function SearchInput({
  value,
  onChange,
  placeholder,
  debounce = 350,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounce?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounce);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="glass flex min-w-52 flex-1 items-center gap-2 rounded-full px-3 py-1.5">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}