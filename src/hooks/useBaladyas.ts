import { useQuery } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { qk } from "@/lib/queryKeys";

export interface BaladyaLite {
  id: string;
  code?: number;
  nameFr?: string;
  nameAr?: string;
  wilayaId?: string;
}

async function fetchBaladyas(wilayaId: string): Promise<BaladyaLite[]> {
  const res = await api.get(`/location/v1/wilayas/${wilayaId}/baladyat`);
  const d = res.data as unknown;
  if (Array.isArray(d)) return d as BaladyaLite[];
  if (d && typeof d === "object") {
    const p = d as Record<string, unknown>;
    const arr = (p.items as BaladyaLite[]) ?? (p.data as BaladyaLite[]) ?? [];
    return Array.isArray(arr) ? arr : [];
  }
  return [];
}

export function useBaladyas(wilayaId?: string) {
  return useQuery({
    queryKey: qk.locations.baladyat(wilayaId ?? ""),
    queryFn: () => fetchBaladyas(wilayaId!),
    enabled: !!wilayaId,
    staleTime: 5 * 60 * 1000,
  });
}
