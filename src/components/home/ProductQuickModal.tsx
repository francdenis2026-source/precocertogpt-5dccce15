import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { Product } from "../../data/catalog";
import { resolveProductImage } from "../../data/productImageResolver";
import "./ProductQuickModal.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const TIME_ZONE = "America/Rio_Branco";

function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE });
}

// Situação de cada loja em relação ao último registro de preço, sem limite de dias.
export function PriceStatus({ value, previous }: { value: number; previous?: number }) {
  if (previous === undefined) {
    return <small className="pqm-status">Primeiro registro</small>;
  }
  if (previous === value) {
    return <small className="pqm-status">Sem alteração no último registro</small>;
  }
  const diff = Math.abs(value - previous);
  const pct = Math.round((diff / previous) * 100);
  const up = value > previous;
  return (
    <small className={`pqm-status ${up ? "is-up" : "is-down"}`}>
      {up ? "Subiu" : "Baixou"} {brl.format(diff)} ({pct}%) · antes {brl.format(previous)}
    </small>
  );
}

type ProductQuickModalProps = { product: Product; onClose: () => void };

export function ProductQuickModal({ product, onClose }: ProductQuickModalProps) {
  const image = resolveProductImage(product);
  const offers = [...(product.offers ?? [])].sort((a, b) => a.value - b.value);
  const detailHref = `/produto/${product.slug || product.id}`;

  // Trava a rolagem da página enquanto o modal está aberto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pqm-overlay" onClick={onClose}>
      <div className="pqm" role="dialog" aria-modal="true" aria-labelledby="pqm-title" onClick={event => event.stopPropagation()}>
        <header className="pqm__head">
          <div className="pqm__thumb">
            {image ? <img src={image} alt="" width="64" height="64" loading="lazy" decoding="async" /> : null}
          </div>
          <div className="pqm__title">
            <h2 id="pqm-title">{product.name}</h2>
            <p>{[product.brand, product.size && product.size !== "-" ? product.size : product.category].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" className="pqm__close" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </header>

        <dl className="pqm__summary">
          <div><dt>Menor preço</dt><dd>{brl.format(product.minPrice)}</dd></div>
          <div><dt>Lojas</dt><dd>{offers.length || product.storeCount || 0}</dd></div>
          <div><dt>Último registro</dt><dd>{formatDate(product.capturedAt)}</dd></div>
        </dl>

        <ul className="pqm__offers">
          {offers.map(offer => (
            <li key={String(offer.establishmentId)}>
              <div className="pqm__store">
                <strong>{offer.establishment}</strong>
                <small>{formatDate(offer.capturedAt)}</small>
              </div>
              <div className="pqm__price">
                <b>{brl.format(offer.value)}</b>
                <PriceStatus value={offer.value} previous={offer.previousPrice} />
              </div>
            </li>
          ))}
          {!offers.length && <li className="pqm__empty">Nenhum preço publicado para este item ainda.</li>}
        </ul>

        <footer className="pqm__foot">
          <Link to={detailHref} onClick={onClose}>Ver página completa →</Link>
        </footer>
      </div>
    </div>
  );
}
