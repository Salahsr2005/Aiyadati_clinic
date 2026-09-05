import { useMutation, useQueryClient } from "@/lib/queryClient";
type QueryKey = ReadonlyArray<unknown>;
import { toast } from "sonner";
import { reportError } from "@/lib/errorReporting";

export interface EntityMutationOptions<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Query keys invalidated after a successful mutation. */
  invalidate?: QueryKey[];
  successMessage?: string | ((data: TData, vars: TVars) => string);
  errorMessage?: string | ((error: Error, vars: TVars) => string);
  /** Loading message shown while the mutation is in-flight. */
  loadingMessage?: string;
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: Error, vars: TVars) => void;
}

/**
 * Shared mutation helper: toast + error reporting + cache invalidation,
 * so every write in the portal behaves identically.
 *
 * When `loadingMessage` is provided, uses Sonner's promise-based toast
 * which shows loading → success → error states automatically.
 */
export function useEntityMutation<TVars, TData = unknown>({
  mutationFn,
  invalidate = [],
  successMessage,
  errorMessage,
  loadingMessage,
  onSuccess,
  onError,
}: EntityMutationOptions<TVars, TData>) {
  const qc = useQueryClient();

  return useMutation<TData, Error, TVars>({
    mutationFn: (vars) => {
      const promise = mutationFn(vars);

      // If loadingMessage is set, show a promise-based toast that
      // automatically transitions between loading → success → error
      if (loadingMessage) {
        toast.promise(promise, {
          loading: loadingMessage,
          success: () =>
            typeof successMessage === "function"
              ? "Done" // we can't call successMessage here because we don't have data+vars
              : (successMessage ?? "Done"),
          error: (err: Error) =>
            typeof errorMessage === "function"
              ? errorMessage(err, vars)
              : (errorMessage ?? err.message ?? "Something went wrong"),
        });
      }

      return promise;
    },
    onSuccess: (data, vars) => {
      // Only show standalone toast if NOT using promise-based toast
      if (!loadingMessage && successMessage) {
        toast.success(
          typeof successMessage === "function" ? successMessage(data, vars) : successMessage,
        );
      }
      invalidate.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
      onSuccess?.(data, vars);
    },
    onError: (error, vars) => {
      reportError(error, { boundary: "entity_mutation" });
      // Only show standalone toast if NOT using promise-based toast
      if (!loadingMessage) {
        const msg = typeof errorMessage === "function"
          ? errorMessage(error, vars)
          : (errorMessage ?? error.message ?? "Something went wrong");
        toast.error(msg);
      }
      onError?.(error, vars);
    },
  });
}
