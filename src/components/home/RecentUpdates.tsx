import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Receipt } from "lucide-react";
import type { Product, StoreRow } from "../../data/catalog";

const TIME_ZONE = "America/Rio_Branco";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const integer = new Intl.NumberFormat("pt-BR");

type Change = { productId: string; name: string; value: number; previous?: number };
type UpdateGroup = {
  key: string;
  store: string;
  day: string;
  capturedAt: string;
  total: number;
  changes: Change[];
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE });

// Agrupa as ofertas por loja e dia de captura: cada grupo é uma "atualização" recebida.
export function buildRecentUpdates(products: Product[], stores: StoreRow[], limit = 4): UpdateGroup[] {
  const totals = new Map(stores.map(store => [String(store.id), store.products]));
  const groups = new Map<string, UpdateGroup>();

  for (const product of products) {
    const offers = product.offers?.length
      ? product.offers
      : [{
          establishmentId: product.establishmentId,
          establishment: product.establishment,
          value: product.minPrice,
          capturedAt: product.capturedAt,
          previousPrice: product.previousPrice,
        }];

    for (const offer of offers) {
      if (!Number.isFinite(Date.parse(offer.capturedAt)) || !offer.establishment) continue;
      const day = dayKey(offer.capturedAt);
      const key = `${offer.establishmentId}|${day}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          store: offer.establishment,
          day,
          capturedAt: offer.capturedAt,
          total: totals.get(String(offer.establishmentId)) ?? 0,
          changes: [],
        };
        groups.set(key, group);
      }
      if (Date.parse(offer.capturedAt) > Date.parse(group.capturedAt)) group.capturedAt = offer.capturedAt;
      group.changes.push({
        productId: String(product.id),
        name: product.name,
        value: offer.value,
        previous: offer.previousPrice,
      });
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.day.localeCompare(a.day) || b.changes.length - a.changes.length)
    .slice(0, limit);
}

function variation(change: Change) {
  if (change.previous === undefined || change.previous === change.value) {
    return `${money.format(change.value)} (sem alteração)`;
  }
  const delta = (change.value - change.previous) / change.previous;
  return `${money.format(change.previous)} → ${money.format(change.value)} (${percent.format(delta)})`;
}

export function RecentUpdates({ products, stores }: { products: Product[]; stores: StoreRow[] }) {
  const groups = useMemo(() => buildRecentUpdates(products, stores), [products, stores]);
  if (!groups.length) return null;

  return (
    <section className="ph-section ph-wrap" aria-labelledby="ph-updates-title">
      <header className="ph-section__head">
        <div>
          <h2 id="ph-updates-title">Últimas atualizações</h2>
          <p>De qual loja vieram os novos preços e quando. Cada atualização traz apenas alguns produtos.</p>
        </div>
      </header>
      <ul className="ph-updates">
        {groups.map(group => {
          const shown = group.changes.slice(0, 3);
          const scope = group.total
            ? `Atualizou ${integer.format(group.changes.length)} de ${integer.format(group.total)} produtos desta loja. Os demais seguem com o último preço registrado.`
            : `Atualizou ${integer.format(group.changes.length)} produtos desta loja. Os demais seguem com o último preço registrado.`;
          return (
            <li key={group.key} className="ph-update">
              <div className="ph-update__head">
                <strong>{group.store}</strong>
                <time dateTime={group.capturedAt}>{dayLabel(group.capturedAt)}</time>
              </div>
              <p className="ph-update__scope">{scope}</p>
              <ul className="ph-update__items">
                {shown.map(change => (
                  <li key={change.productId}>
                    <span>{change.name}</span>
                    <span>{variation(change)}</span>
                  </li>
                ))}
              </ul>
              {group.changes.length > shown.length && (
                <p className="ph-update__more">+ {integer.format(group.changes.length - shown.length)} produtos atualizados</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ShareReceiptsBanner() {
  return (
    <section className="ph-wrap ph-notes-banner" aria-labelledby="ph-notes-title">
      <div className="ph-notes-banner__copy">
        <Receipt aria-hidden="true" />
        <div>
          <h2 id="ph-notes-title">Ajude a manter os preços de Feijó atualizados</h2>
          <p>Compartilhe as notas das suas compras. Cada nota ajuda outras pessoas a economizar.</p>
        </div>
      </div>
      <Link className="ph-btn ph-btn--primary" to="/colaborar">Enviar minhas notas <ArrowRight aria-hidden="true" /></Link>
    </section>
  );
}
