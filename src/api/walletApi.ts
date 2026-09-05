import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListParams, type ListResult } from "@/lib/adminApi";

/**
 * Shape of an admin transaction as returned by GET /wallet/v1/transactions
 * (see OpenAPI schema `AdminTransactionResponse`). Fields the previous UI
 * expected (`paymentProvider`, `paymentReference`, `reason`) are kept as
 * optional client-side extras so any richer server payload still binds.
 */
export interface WalletTransaction {
  id: string;
  /** Raw type from the backend: "purchase" | "use" | "refund" | "admin_grant". */
  type?: string;
  /** Credit delta (positive = credit in, negative = credit out). */
  amount?: number;
  credits?: number;
  balance?: number;
  description?: string | null;
  /** Backend field name (previously mis-read as paymentReference). */
  referenceId?: string | null;
  performedBy?: string | null;
  userId?: string;
  walletId?: string;
  adminId?: string;
  createdAt: string;
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  // Legacy / optional fields — kept so older UI paths compile safely.
  reason?: string | null;
  paymentReference?: string | null;
  paymentProvider?: string | null;
}

export interface UserWallet {
  id?: string;
  userId?: string;
  balance?: number;
  credits?: number;
  freeCredits?: number;
  transactions?: WalletTransaction[];
}

export interface WalletListParams extends ListParams {
  /** Backend accepts lowercase enum: purchase|use|refund|admin_grant. */
  type?: string;
  userId?: string;
  walletId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
}

/** Canonical UI categories mapped from the raw backend `type` field. */
export type TxnKind = "purchase" | "use" | "refund" | "admin_grant" | "other";

export function canonicalTxnKind(t?: string | null, amount?: number): TxnKind {
  const raw = String(t ?? "").toLowerCase();
  if (raw === "purchase" || raw === "use" || raw === "refund" || raw === "admin_grant") return raw;
  // Fallbacks for legacy uppercase values (GRANT, SPEND).
  if (raw === "grant") return "admin_grant";
  if (raw === "spend") return "use";
  if (raw === "purchase") return "purchase";
  // Direction-based inference when the backend omits type.
  if ((amount ?? 0) < 0) return "use";
  if ((amount ?? 0) > 0) return "purchase";
  return "other";
}

export const TXN_LABEL: Record<TxnKind, string> = {
  purchase: "Purchase",
  use: "Spend",
  refund: "Refund",
  admin_grant: "Admin grant",
  other: "Other",
};

export const TXN_COLOR: Record<TxnKind, string> = {
  purchase: "#3b82f6",
  use: "#ef4444",
  refund: "#f59e0b",
  admin_grant: "#10b981",
  other: "#8b5cf6",
};

function cleanParams(p: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number;
  }
  return out;
}

export const walletApi = {
  getTransactions: async (params: WalletListParams = {}): Promise<ListResult<WalletTransaction>> => {
    const res = await api.get("/wallet/v1/transactions", {
      params: cleanParams(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(
      normalizeList<WalletTransaction>(res.data, params.page ?? 1, params.limit ?? 20),
      meta,
    );
  },
  getUserWallet: async (userId: string): Promise<UserWallet> => {
    const res = await api.get(`/wallet/v1/user/${userId}`);
    return res.data as UserWallet;
  },
  grantCredits: async (userId: string, payload: { credits: number; reason?: string }) => {
    const res = await api.post(`/wallet/v1/user/${userId}/grant`, payload);
    return res.data;
  },
};
