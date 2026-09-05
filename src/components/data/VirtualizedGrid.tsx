import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const VIRTUAL_THRESHOLD = 50;
const DEFAULT_ROW_HEIGHT = 188;

export function VirtualizedGrid<T>({
  items,
  renderItem,
  getKey,
  className,
  rowHeight = DEFAULT_ROW_HEIGHT,
  columnsClass = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  className?: string;
  rowHeight?: number;
  columnsClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [cols, setCols] = useState(4);

  const measureCols = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? 1200;
    if (w < 640) setCols(1);
    else if (w < 1024) setCols(2);
    else if (w < 1280) setCols(3);
    else setCols(4);
  }, []);

  if (items.length <= VIRTUAL_THRESHOLD) {
    return (
      <div className={cn(columnsClass, className)}>
        {items.map((item, i) => (
          <div key={getKey(item, i)}>{renderItem(item, i)}</div>
        ))}
      </div>
    );
  }

  const rowCount = Math.ceil(items.length / cols);
  const viewportH = containerRef.current?.clientHeight ?? 600;
  const overscan = 2;
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleRows = Math.ceil(viewportH / rowHeight) + overscan * 2;
  const endRow = Math.min(rowCount, startRow + visibleRows);
  const startIdx = startRow * cols;
  const endIdx = Math.min(items.length, endRow * cols);
  const visible = items.slice(startIdx, endIdx);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-y-auto", className)}
      style={{ maxHeight: "70vh" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onLoad={measureCols}
    >
      <div style={{ height: rowCount * rowHeight, position: "relative" }}>
        <div
          className={columnsClass}
          style={{ position: "absolute", top: startRow * rowHeight, left: 0, right: 0 }}
        >
          {visible.map((item, i) => (
            <div key={getKey(item, startIdx + i)}>{renderItem(item, startIdx + i)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
