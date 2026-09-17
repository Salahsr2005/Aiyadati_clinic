import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

type QueryKey = ReadonlyArray<unknown>;

type QueryState<TData = any, TError = any> = {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  status: "pending" | "error" | "success";
};

type QueryOptions<TQueryFnData = any, TError = any, TData = TQueryFnData> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TQueryFnData>;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
  retry?: number | boolean;
  select?: (data: TQueryFnData) => TData;
  initialData?: TData;
};

type MutationOptions<TData = any, TError = any, TVariables = void, TContext = unknown> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<unknown>;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void | Promise<unknown>;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void | Promise<unknown>;
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
};

function hashKey(key: QueryKey): string {
  return JSON.stringify(key, (_, val) => {
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce((acc: any, k) => {
          acc[k] = (val as any)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

function matchesKey(queryKey: QueryKey, targetKey: QueryKey): boolean {
  if (targetKey.length > queryKey.length) return false;
  for (let i = 0; i < targetKey.length; i++) {
    if (JSON.stringify(queryKey[i]) !== JSON.stringify(targetKey[i])) {
      return false;
    }
  }
  return true;
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.response?.status || error.status;
  // Do not retry 4xx client errors (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable)
  if (status && status >= 400 && status < 500) {
    return false;
  }
  return true;
}

class QueryCacheEntry {
  key: QueryKey;
  keyHash: string;
  data: any = undefined;
  error: any = null;
  updatedAt: number = 0;
  promise: Promise<any> | null = null;
  queryFn: (() => Promise<any>) | null = null;
  listeners: Set<() => void> = new Set();

  constructor(key: QueryKey) {
    this.key = key;
    this.keyHash = hashKey(key);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  async fetch(queryFn: () => Promise<any>, retryOption: number | boolean = 1): Promise<any> {
    this.queryFn = queryFn;
    if (this.promise) return this.promise;

    const maxRetries = typeof retryOption === "number" ? retryOption : retryOption ? 1 : 0;
    this.notify();

    this.promise = (async () => {
      let attempt = 0;
      try {
        while (true) {
          try {
            const res = await queryFn();
            this.data = res;
            this.error = null;
            this.updatedAt = Date.now();
            return res;
          } catch (err) {
            if (attempt < maxRetries && isRetryableError(err)) {
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            this.error = err;
            throw err;
          }
        }
      } finally {
        this.promise = null;
        this.notify();
      }
    })();

    return this.promise;
  }
}

export class QueryClient {
  private cache: Map<string, QueryCacheEntry> = new Map();

  getEntry(key: QueryKey): QueryCacheEntry {
    const hash = hashKey(key);
    if (!this.cache.has(hash)) {
      this.cache.set(hash, new QueryCacheEntry(key));
    }
    return this.cache.get(hash)!;
  }

  getQueryData<TData = unknown>(queryKey: QueryKey): TData | undefined {
    const hash = hashKey(queryKey);
    return this.cache.get(hash)?.data;
  }

  setQueryData<TData = unknown>(
    queryKey: QueryKey,
    updater: TData | ((oldData: TData | undefined) => TData)
  ): TData {
    const entry = this.getEntry(queryKey);
    const newData = typeof updater === "function" ? (updater as any)(entry.data) : updater;
    entry.data = newData;
    entry.updatedAt = Date.now();
    entry.notify();
    return newData;
  }

  async invalidateQueries(filters?: { queryKey?: QueryKey }): Promise<void> {
    const targetKey = filters?.queryKey;
    const promises: Promise<any>[] = [];
    this.cache.forEach((entry) => {
      if (!targetKey || matchesKey(entry.key, targetKey)) {
        entry.updatedAt = 0;
        if (entry.listeners.size > 0 && entry.queryFn) {
          promises.push(entry.fetch(entry.queryFn).catch(() => {}));
        } else {
          entry.notify();
        }
      }
    });
    await Promise.all(promises);
  }

  resetQueries(filters?: { queryKey?: QueryKey }): void {
    const targetKey = filters?.queryKey;
    this.cache.forEach((entry, hash) => {
      if (!targetKey || matchesKey(entry.key, targetKey)) {
        this.cache.delete(hash);
      }
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const QueryClientContext = createContext<QueryClient | null>(null);

export const QueryClientProvider: React.FC<{
  client: QueryClient;
  children: React.ReactNode;
}> = ({ client, children }) => {
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  );
};

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a QueryClientProvider");
  }
  return client;
}

export function useQuery<TQueryFnData = any, TError = any, TData = TQueryFnData>(
  options: QueryOptions<TQueryFnData, TError, TData>
): QueryState<TData, TError> & { refetch: () => Promise<any> } {
  const client = useQueryClient();
  const {
    queryKey,
    queryFn,
    enabled = true,
    staleTime,
    refetchInterval,
    retry = 1,
    select,
    initialData,
  } = options;
  const entry = client.getEntry(queryKey);

  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const unsubscribe = entry.subscribe(forceUpdate);
    return unsubscribe;
  }, [entry, forceUpdate]);

  const queryFnRef = useRef(queryFn);
  useEffect(() => {
    queryFnRef.current = queryFn;
    entry.queryFn = queryFn;
  }, [queryFn, entry]);

  const refetch = useCallback(() => {
    return entry.fetch(queryFnRef.current, retry);
  }, [entry, retry]);

  useEffect(() => {
    if (!enabled) return;

    const isStale =
      entry.updatedAt === 0 ||
      entry.data === undefined ||
      (staleTime !== undefined ? Date.now() - entry.updatedAt >= staleTime : true);

    if (isStale && !entry.promise) {
      entry.fetch(queryFnRef.current, retry).catch(() => {});
    }
  }, [enabled, entry, hashKey(queryKey), staleTime, retry]);

  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return;

    const intervalId = setInterval(() => {
      entry.fetch(queryFnRef.current, retry).catch(() => {});
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [enabled, refetchInterval, entry, retry]);

  const rawData = entry.data !== undefined ? entry.data : initialData;
  const data = select && rawData !== undefined ? select(rawData) : rawData;
  const isFetching = !!entry.promise;
  const isLoading = rawData === undefined && isFetching;
  const isError = !!entry.error;
  const isSuccess = rawData !== undefined && !isError;
  const status: "pending" | "error" | "success" = isLoading
    ? "pending"
    : isError
    ? "error"
    : "success";

  return {
    data,
    error: entry.error,
    isLoading,
    isFetching,
    isError,
    isSuccess,
    status,
    refetch,
  };
}

export function useQueries<T extends Array<QueryOptions<any, any, any>>>({
  queries,
}: {
  queries: [...T];
}) {
  const client = useQueryClient();
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  const keyHashes = queries.map((q) => hashKey(q.queryKey)).join("|");

  useEffect(() => {
    const unsubscribes = queriesRef.current.map((opt) => {
      const entry = client.getEntry(opt.queryKey);
      return entry.subscribe(forceUpdate);
    });
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [client, forceUpdate, keyHashes]);

  useEffect(() => {
    queriesRef.current.forEach((opt) => {
      const { queryKey, queryFn, enabled = true, staleTime, retry = 1 } = opt;
      if (!enabled) return;
      const entry = client.getEntry(queryKey);
      entry.queryFn = queryFn;

      const isStale =
        entry.updatedAt === 0 ||
        entry.data === undefined ||
        (staleTime !== undefined ? Date.now() - entry.updatedAt >= staleTime : true);

      if (isStale && !entry.promise) {
        entry.fetch(queryFn, retry).catch(() => {});
      }
    });
  }, [client, keyHashes]);

  return queries.map((opt) => {
    const { queryKey, select, initialData, retry = 1 } = opt;
    const entry = client.getEntry(queryKey);
    const rawData = entry.data !== undefined ? entry.data : initialData;
    const data = select && rawData !== undefined ? select(rawData) : rawData;
    const isFetching = !!entry.promise;
    const isLoading = rawData === undefined && isFetching;
    const isError = !!entry.error;
    const isSuccess = rawData !== undefined && !isError;
    const status: "pending" | "error" | "success" = isLoading
      ? "pending"
      : isError
      ? "error"
      : "success";

    return {
      data,
      error: entry.error,
      isLoading,
      isFetching,
      isError,
      isSuccess,
      status,
      refetch: () => entry.fetch(opt.queryFn, retry),
    };
  });
}

export function useMutation<TData = any, TError = any, TVariables = void, TContext = unknown>(
  options: MutationOptions<TData, TError, TVariables, TContext>
) {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsPending(true);
      setError(null);
      setIsError(false);
      setIsSuccess(false);

      let context: TContext | undefined;
      try {
        if (options.onMutate) {
          context = await options.onMutate(variables);
        }
        const res = await options.mutationFn(variables);
        setData(res);
        setIsSuccess(true);
        if (options.onSuccess) {
          await options.onSuccess(res, variables, context);
        }
        if (options.onSettled) {
          await options.onSettled(res, null, variables, context);
        }
        return res;
      } catch (err: any) {
        setError(err);
        setIsError(true);
        if (options.onError) {
          await options.onError(err, variables, context);
        }
        if (options.onSettled) {
          await options.onSettled(undefined, err, variables, context);
        }
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [options]
  );

  const mutate = useCallback(
    (variables: TVariables, callbacks?: Partial<MutationOptions<TData, TError, TVariables, TContext>>) => {
      mutateAsync(variables)
        .then((res) => callbacks?.onSuccess?.(res, variables, undefined))
        .catch((err) => callbacks?.onError?.(err, variables, undefined));
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isPending,
    isLoading: isPending,
    isSuccess,
    isError,
    reset: () => {
      setData(undefined);
      setError(null);
      setIsPending(false);
      setIsSuccess(false);
      setIsError(false);
    },
  };
}
