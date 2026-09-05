import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable, type Column } from "@/components/data/DataTable";
import { SearchInput } from "@/components/data/SearchInput";
import { FilterChips } from "@/components/data/FilterChips";
import { useListState } from "@/hooks/useListState";
import { adminResource } from "@/lib/adminApi";

export function ResourceListPage<T extends { id?: string | number }>({
  resource,
  title,
  subtitle,
  columns,
  statusOptions,
  onRowClick,
  actions,
  searchPlaceholder,
  emptyTitle,
}: {
  resource: string;
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  statusOptions?: { value: string | undefined; label: string }[];
  onRowClick?: (row: T) => void;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  emptyTitle?: string;
}) {
  const { t } = useTranslation();
  const state = useListState();
  const client = useMemo(() => adminResource<T>(resource), [resource]);

  const q = useQuery({
    queryKey: ["admin", resource, state.page, state.limit, state.search, state.status, state.extras],
    queryFn: () =>
      client.list({
        page: state.page,
        limit: state.limit,
        search: state.search || undefined,
        status: state.status,
        ...state.extras,
      }),
    retry: (count, err) => {
      const e = err as { status?: number };
      if (e?.status === 403 || e?.status === 404) return false;
      return count < 2;
    },
  });

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <DataTable<T>
        columns={columns}
        rows={q.data?.items ?? []}
        loading={q.isLoading || q.isFetching}
        error={q.error as Error | null}
        page={q.data?.page ?? state.page}
        totalPages={q.data?.totalPages ?? 1}
        total={q.data?.total ?? 0}
        limit={state.limit}
        onPage={state.setPage}
        onLimit={state.setLimit}
        onRowClick={onRowClick}
        emptyTitle={emptyTitle}
        toolbar={
          <>
            <SearchInput
              value={state.search}
              onChange={state.setSearch}
              placeholder={searchPlaceholder || t("common.search")}
            />
            {statusOptions && (
              <FilterChips
                value={state.status}
                options={statusOptions}
                onChange={(v) => state.setStatus(v)}
              />
            )}
          </>
        }
      />
    </div>
  );
}