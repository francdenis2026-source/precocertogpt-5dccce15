import { TrendingDown, TrendingUp } from "lucide-react";
import { priceChange } from "../../lib/priceChange";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PriceChangeBadge({ current, previous, capturedAt }: {
  current?: number; previous?: number; capturedAt?: string | null;
}) {
  const change = priceChange(current, previous, capturedAt);
  if (!change) return null;
  const up = change.dir === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title={`Preço anterior: ${brl.format(previous!)}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px",
        borderRadius: 999, fontSize: "0.75rem", fontWeight: 800, whiteSpace: "nowrap",
        background: up ? "#fde8e8" : "#e3f6ea", color: up ? "#b42318" : "#146c3a",
      }}
    >
      <Icon aria-hidden="true" width={12} height={12} />
      {up ? "Subiu" : "Baixou"} {brl.format(change.diff)} ({change.pct}%)
    </span>
  );
}
