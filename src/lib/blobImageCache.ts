import { api } from "@/lib/api";
import { resolveFileUrl } from "@/lib/utils";

// In-memory cache for ObjectURLs (URL -> blobUrl)
const blobCache = new Map<string, string>();
const cacheOrder: string[] = [];
const MAX_CACHE_SIZE = 400;

// In-flight fetch deduplication map
const pendingFetches = new Map<string, Promise<string | null>>();

function evictOldest() {
  if (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldest = cacheOrder.shift();
    if (oldest && blobCache.has(oldest)) {
      const blobUrl = blobCache.get(oldest);
      blobCache.delete(oldest);
      if (blobUrl && blobUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * Checks synchronously if an image is already cached as a Blob URL.
 */
export function getCachedBlobUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const resolved = resolveFileUrl(rawUrl);
  if (!resolved) return null;

  // Local assets, data URIs, or blob URIs don't need blob conversion
  if (
    resolved.startsWith("data:") ||
    resolved.startsWith("blob:") ||
    resolved.startsWith("/assets/") ||
    resolved.startsWith("assets/") ||
    resolved.includes("/@fs/") ||
    resolved.includes("/src/assets/")
  ) {
    return resolved;
  }

  return blobCache.get(resolved) || null;
}

/**
 * Loads a remote image URL via CORS fetch / axios and returns a same-origin blob: URL.
 * Completely avoids `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` caused by Cross-Origin-Resource-Policy.
 */
export async function loadBlobImage(rawUrl?: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  const resolved = resolveFileUrl(rawUrl);
  if (!resolved) return null;

  // If already a local/blob/data URL, return as-is
  if (
    resolved.startsWith("data:") ||
    resolved.startsWith("blob:") ||
    resolved.startsWith("/assets/") ||
    resolved.startsWith("assets/") ||
    resolved.includes("/@fs/") ||
    resolved.includes("/src/assets/")
  ) {
    return resolved;
  }

  // If already in memory cache, return cached blobUrl
  if (blobCache.has(resolved)) {
    return blobCache.get(resolved)!;
  }

  // If already in flight, reuse existing promise
  if (pendingFetches.has(resolved)) {
    return pendingFetches.get(resolved)!;
  }

  const fetchPromise = (async (): Promise<string | null> => {
    try {
      // 1. First attempt: standard CORS fetch
      const res = await fetch(resolved, {
        mode: "cors",
        credentials: "omit",
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          blobCache.set(resolved, blobUrl);
          cacheOrder.push(resolved);
          evictOldest();
          return blobUrl;
        }
      }
    } catch {
      // Fetch failed or blocked, fall through to axios
    }

    try {
      // 2. Second attempt: Axios client (handles auth headers if needed)
      const axiosRes = await api.get(resolved, {
        responseType: "blob",
      });

      if (axiosRes.data instanceof Blob && axiosRes.data.size > 0) {
        const blobUrl = URL.createObjectURL(axiosRes.data);
        blobCache.set(resolved, blobUrl);
        cacheOrder.push(resolved);
        evictOldest();
        return blobUrl;
      }
    } catch {
      // Request failed
    }

    return null;
  })().finally(() => {
    pendingFetches.delete(resolved);
  });

  pendingFetches.set(resolved, fetchPromise);
  return fetchPromise;
}
