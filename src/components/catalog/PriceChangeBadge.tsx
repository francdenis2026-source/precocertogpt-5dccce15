import { Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { PricePromo } from "../../data/catalog";
import { priceChange } from "../../lib/priceChange";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Rio_Branco" });

/** Selo de preço promocional com validade; tem prioridade sobre subiu/baixou. */
export function PromoBadge({ promo }: { promo: PricePromo }) {
  const until = shortDate.format(new Date(promo.until));
  const regular = promo.regularPrice ? ` · normal ${brl.format(promo.regularPrice)}` : "";
  return (
    <span
      title={`Preço promocional válido até ${until}${regular}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px",
        borderRadius: 999, fontSize: "0.75rem", fontWeight: 800, whiteSpace: "nowrap",
        background: "#111827", color: "#fde047",
      }}
    >
      <Tag aria-hidden="true" width={12} height={12} />
      {promo.label} até {until}{regular}
    </span>
  );
}

export function PriceChangeBadge({ current, previous, capturedAt, promo }: {
  current?: number; previous?: number; capturedAt?: string | null; promo?: PricePromo;
}) {
  if (promo) return <PromoBadge promo={promo} />;
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
