import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { Loader2, ShieldOff, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import { EmptyState } from "@/components/data/EmptyState";
import { Pagination } from "@/components/data/Pagination";
import { isForbidden } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  sortable?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  loading,
  error,
  page,
  totalPages,
  total,
  limit,
  onPage,
  onLimit,
  onRowClick,
  rowKey,
  toolbar,
  emptyTitle,
  emptyDescription,
  selectable,
  selectedIds,
  onSelectionChange,
  getRowId,
  sortKey,
  sortOrder,
  onSort,
  mobileCard,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: Error | null;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  onLimit?: (n: number) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, i: number) => string;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  getRowId?: (row: T) => string;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  /** Render rows as stacked label/value cards below the `md` breakpoint instead of a scrolling table. */
  mobileCard?: boolean;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // States
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set(columns.map((c) => c.key)));
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortOrder, setLocalSortOrder] = useState<"asc" | "desc">("asc");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVisibilityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update container height
  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight || 500);
    }
  }, [rows.length]);

  const activeSortKey = sortKey ?? localSortKey;
  const activeSortOrder = sortOrder ?? localSortOrder;

  // Handle header sorting click
  const handleSort = (key: string) => {
    const isCurrent = activeSortKey === key;
    const nextOrder = isCurrent && activeSortOrder === "asc" ? "desc" : "asc";

    if (onSort) {
      onSort(key, nextOrder);
    } else {
      setLocalSortKey(key);
      setLocalSortOrder(nextOrder);
    }
  };

  // Sort rows client-side if no external onSort is provided
  const processedRows = useMemo(() => {
    if (onSort || !localSortKey) return rows;

    return [...rows].sort((a, b) => {
      const valA = (a as any)[localSortKey];
      const valB = (b as any)[localSortKey];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      let comparison = 0;
      if (typeof valA === "string" && typeof valB === "string") {
        comparison = valA.localeCompare(valB);
      } else {
        comparison = valA < valB ? -1 : 1;
      }

      return localSortOrder === "asc" ? comparison : -comparison;
    });
  }, [rows, localSortKey, localSortOrder, onSort]);

  // Selectable row helpers
  const getId = (r: T) => (getRowId ? getRowId(r) : String(r.id ?? ""));
  const pageIds = processedRows.map(getId).filter(Boolean);
  const allSelected =
    selectable && pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));
  const someSelected =
    selectable && !allSelected && pageIds.some((id) => selectedIds?.has(id));

  const toggleAll = () => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  // Virtual Scrolling calculation if rows > 200
  const rowHeight = 52;
  const isVirtual = processedRows.length > 200;

  const { visibleRows, spacerTop, spacerBottom, actualStartIndex } = useMemo(() => {
    if (!isVirtual) {
      return {
        visibleRows: processedRows,
        spacerTop: 0,
        spacerBottom: 0,
        actualStartIndex: 0,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
    const end = Math.min(processedRows.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 10);

    return {
      visibleRows: processedRows.slice(start, end),
      spacerTop: start * rowHeight,
      spacerBottom: (processedRows.length - end) * rowHeight,
      actualStartIndex: start,
    };
  }, [processedRows, isVirtual, scrollTop, containerHeight]);

  // Keyboard navigation keydown handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (processedRows.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev === null ? 0 : Math.min(processedRows.length - 1, prev + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
    } else if (e.key === "Enter" && focusedIndex !== null) {
      e.preventDefault();
      const row = processedRows[focusedIndex];
      if (selectable) {
        toggleOne(getId(row));
      } else if (onRowClick) {
        onRowClick(row);
      }
    }
  };

  // Auto scroll focused row into view
  useEffect(() => {
    if (focusedIndex !== null && isVirtual && containerRef.current) {
      const rowTop = focusedIndex * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const viewTop = scrollTop;
      const viewBottom = scrollTop + containerHeight;

      if (rowTop < viewTop) {
        containerRef.current.scrollTop = rowTop;
      } else if (rowBottom > viewBottom) {
        containerRef.current.scrollTop = rowBottom - containerHeight;
      }
    }
  }, [focusedIndex, isVirtual, containerHeight, scrollTop]);

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return columns.filter((c) => visibleKeys.has(c.key));
  }, [columns, visibleKeys]);

  const toggleColumnVisibility = (key: string) => {
    const next = new Set(visibleKeys);
    if (next.has(key)) {
      if (next.size > 1) {
        next.delete(key);
      }
    } else {
      next.add(key);
    }
    setVisibleKeys(next);
  };

  return (
    <GlassCard className="p-0 flex flex-col h-full relative overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex flex-1 items-center gap-2">{toolbar}</div>
        
        {/* Column Visibility Control */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-primary-500/10 cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Columns
          </button>

          {showVisibilityDropdown && (
            <div className="absolute end-0 mt-2 w-48 rounded-2xl border border-border bg-popover/95 p-2 shadow-xl backdrop-blur-md z-30">
              <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Show/Hide Columns
              </div>
              <div className="space-y-0.5 mt-1">
                {columns.map((c) => {
                  const isVisible = visibleKeys.has(c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleColumnVisibility(c.key)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl hover:bg-accent/50 text-start transition-colors"
                    >
                      <span className="font-medium text-foreground">{c.header}</span>
                      {isVisible && <Check className="h-3.5 w-3.5 text-primary-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrolling Table Body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className="relative w-full overflow-y-auto flex-1 outline-none focus:ring-1 focus:ring-primary-500/20"
        style={{ maxHeight: isVirtual ? "600px" : undefined }}
      >
        <table className={cn("w-full text-sm", mobileCard && "hidden md:table")}>
          {/* Sticky Table Header */}
          <thead className="sticky top-0 bg-background/95 backdrop-blur-md z-10 border-b border-border/60">
            <tr className="text-start text-xs uppercase tracking-wide text-muted-foreground">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={!!allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-[var(--primary-500)] cursor-pointer"
                  />
                </th>
              )}
              {visibleColumns.map((c) => {
                const isCurrent = activeSortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-3 font-semibold select-none",
                      c.sortable && "cursor-pointer hover:text-foreground transition-colors",
                      c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start",
                    )}
                    onClick={() => c.sortable && handleSort(c.key)}
                  >
                    <div className={cn("flex items-center gap-1.5", c.align === "end" && "justify-end", c.align === "center" && "justify-center")}>
                      <span>{c.header}</span>
                      {c.sortable && (
                        isCurrent ? (
                          activeSortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-primary-500 shrink-0" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-primary-500 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground shrink-0" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 && (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border/40">
                  {selectable && <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>}
                  {visibleColumns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!loading && processedRows.length > 0 && (
              <>
                {/* Top spacer for virtual scrolling */}
                {isVirtual && spacerTop > 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} style={{ height: `${spacerTop}px` }} />
                  </tr>
                )}

                {visibleRows.map((row, i) => {
                  const actualIdx = actualStartIndex + i;
                  const id = selectable ? getId(row) : "";
                  const isSelected = selectable && !!selectedIds?.has(id);
                  const isFocused = focusedIndex === actualIdx;

                  return (
                    <tr
                      key={rowKey ? rowKey(row, actualIdx) : String(row.id ?? actualIdx)}
                      onClick={() => {
                        setFocusedIndex(actualIdx);
                        onRowClick?.(row);
                      }}
                      className={cn(
                        "border-t border-border/40 transition-colors duration-150 outline-none",
                        onRowClick ? "cursor-pointer hover:bg-accent/40" : "",
                        isSelected ? "bg-primary-500/5" : "",
                        isFocused ? "bg-accent/60 ring-2 ring-primary-500/30 ring-inset" : "",
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={isSelected}
                            onChange={() => toggleOne(id)}
                            className="h-4 w-4 rounded border-border accent-[var(--primary-500)] cursor-pointer"
                          />
                        </td>
                      )}
                      {visibleColumns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-4 py-3 align-middle",
                            c.className,
                            c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start",
                          )}
                        >
                          {c.render(row, actualIdx)}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Bottom spacer for virtual scrolling */}
                {isVirtual && spacerBottom > 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} style={{ height: `${spacerBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {mobileCard && (
          <div className="md:hidden divide-y divide-border/40">
            {loading && rows.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`sk-card-${i}`} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}

            {!loading &&
              processedRows.length > 0 &&
              visibleRows.map((row, i) => {
                const actualIdx = actualStartIndex + i;
                const id = selectable ? getId(row) : "";
                const isSelected = selectable && !!selectedIds?.has(id);

                return (
                  <div
                    key={rowKey ? rowKey(row, actualIdx) : String(row.id ?? actualIdx)}
                    onClick={() => {
                      setFocusedIndex(actualIdx);
                      onRowClick?.(row);
                    }}
                    className={cn(
                      "p-4 space-y-2 transition-colors duration-150",
                      onRowClick ? "cursor-pointer active:bg-accent/40" : "",
                      isSelected ? "bg-primary-500/5" : "",
                    )}
                  >
                    {selectable && (
                      <div
                        className="flex items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={isSelected}
                          onChange={() => toggleOne(id)}
                          className="h-4 w-4 rounded border-border accent-[var(--primary-500)] cursor-pointer"
                        />
                      </div>
                    )}
                    {visibleColumns.map((c) => (
                      <div key={c.key} className="flex items-start justify-between gap-3 text-xs">
                        <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground text-[10px] pt-0.5">
                          {c.header}
                        </span>
                        <span className={cn("min-w-0 text-end", c.className)}>{c.render(row, actualIdx)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}

        {loading && processedRows.length > 0 && (
          <div className="pointer-events-none absolute end-3 top-3 z-20 bg-background/80 backdrop-blur px-2 py-1 rounded-full border border-border/40">
            <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
          </div>
        )}

        {!loading && !error && processedRows.length === 0 && (
          <div className="p-8">
            <EmptyState
              title={emptyTitle || t("common.empty")}
              description={emptyDescription}
            />
          </div>
        )}

        {!loading && error && (
          <div className="p-8">
            <EmptyState
              icon={isForbidden(error) ? ShieldOff : undefined}
              title={isForbidden(error) ? t("table.forbidden", { defaultValue: "Access denied" }) : t("common.error")}
              description={
                isForbidden(error)
                  ? t("table.forbiddenHint", {
                      defaultValue:
                        "This admin account lacks permission for this resource. Ask a SUPER_ADMIN to grant access.",
                    })
                  : error.message
              }
            />
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-border/40 bg-background/20">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPage={onPage}
          onLimit={onLimit}
        />
      </div>
    </GlassCard>
  );
}
