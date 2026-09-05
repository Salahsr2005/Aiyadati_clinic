import { useState, useCallback } from "react";

export interface ListState {
  page: number;
  limit: number;
  search: string;
  status?: string;
  extras: Record<string, string | number | undefined>;
}

export function useListState(initial?: Partial<ListState>) {
  const [state, setState] = useState<ListState>({
    page: 1,
    limit: 20,
    search: "",
    status: undefined,
    extras: {},
    ...initial,
  });

  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), []);
  const setLimit = useCallback((limit: number) => setState((s) => ({ ...s, limit, page: 1 })), []);
  const setSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search, page: 1 })),
    [],
  );
  const setStatus = useCallback(
    (status: string | undefined) => setState((s) => ({ ...s, status, page: 1 })),
    [],
  );
  const setExtra = useCallback(
    (k: string, v: string | number | undefined) =>
      setState((s) => ({ ...s, extras: { ...s.extras, [k]: v }, page: 1 })),
    [],
  );

  return { ...state, setPage, setLimit, setSearch, setStatus, setExtra };
}