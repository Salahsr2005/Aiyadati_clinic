import { useQuery } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { ensureArray } from "@/lib/utils";

export interface WilayaLite {
  id: string;
  code?: number;
  nameFr?: string;
  nameAr?: string;
}

async function fetchWilayas(): Promise<WilayaLite[]> {
  const res = await api.get("/location/v1/wilayas", { params: { limit: 100 } });
  return ensureArray<WilayaLite>(res);
}

export function useWilayas() {
  return useQuery({
    queryKey: ["wilayas-lookup"],
    queryFn: fetchWilayas,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWilayaMap() {
  const q = useQuery({
    queryKey: ["wilayas-lookup"],
    queryFn: fetchWilayas,
    staleTime: 5 * 60 * 1000,
  });
  const map = new Map<string, WilayaLite>();
  (q.data ?? []).forEach((w) => map.set(w.id, w));
  return { map, wilayas: q.data ?? [], isLoading: q.isLoading };
}

export interface BaladyaLite {
  id: string;
  wilayaId?: string;
  nameFr?: string;
  nameAr?: string;
}

async function fetchBaladyas(wilayaId?: string | number): Promise<BaladyaLite[]> {
  if (!wilayaId) return [];
  const res = await api.get(`/location/v1/wilayas/${wilayaId}/baladyat`, { params: { limit: 100 } });
  return ensureArray<BaladyaLite>(res);
}

export function useBaladyas(wilayaId?: string | number) {
  return useQuery({
    queryKey: ["baladyat-lookup", String(wilayaId || "")],
    queryFn: () => fetchBaladyas(wilayaId),
    enabled: !!wilayaId,
    staleTime: 5 * 60 * 1000,
  });
}