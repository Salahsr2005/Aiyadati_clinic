import { paymentProviderIcon } from "@/lib/assetFallbacks";

export function PaymentIcon({
  provider,
  size = 20,
  className = "",
}: {
  provider?: string | null;
  size?: number;
  className?: string;
}) {
  const src = paymentProviderIcon(provider);
  return (
    <span
      className={`inline-grid place-items-center overflow-hidden rounded-md bg-white/70 ring-1 ring-border/40 ${className}`}
      style={{ width: size + 6, height: size + 6 }}
      title={provider ?? "Payment"}
    >
      <img src={src} alt={provider ?? "payment"} style={{ width: size, height: size, objectFit: "contain" }} />
    </span>
  );
}
