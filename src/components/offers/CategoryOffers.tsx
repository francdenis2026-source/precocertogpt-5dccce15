import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Store, Tag } from "lucide-react";
import { loadPublicOffers, offerSlug, type PlatformOffer } from "../../lib/offers";
import "./CategoryOffers.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function OfferMedia({ imageUrl, productName, discount }: { imageUrl: string | null; productName: string; discount: number | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  return (
    <span className="pc-offers__media">
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={productName} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="pc-offers__media-fallback" role="img" aria-label={`Imagem de ${productName} indisponível`}>
          <Tag aria-hidden="true" />
          <small>Imagem indisponível</small>
        </span>
      )}
      {discount !== null && <em className="pc-offers__badge">-{discount}%</em>}
    </span>
  );
}

function remaining(endsAt: string | null) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? "dia" : "dias"} restantes`;
  const hours = Math.max(1, Math.round(diff / 3_600_000));
  return `${hours}h restantes`;
}

export type CategoryOffersProps = {
  /** Slug ou nome da categoria/setor. Vazio mostra todas as ofertas ativas. */
  categorySlug?: string | null;
  title?: string;
  limit?: number;
};

/** Faixa de ofertas administradas no painel, exibida em categorias e setores. */
export function CategoryOffers({ categorySlug, title = "Ofertas da semana", limit = 8 }: CategoryOffersProps) {
  const [offers, setOffers] = useState<PlatformOffer[]>([]);
  const wanted = useMemo(() => (categorySlug ? offerSlug(categorySlug) : null), [categorySlug]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void loadPublicOffers()
        .then(rows => {
          if (alive) setOffers(rows);
        })
        .catch(() => {
          if (alive) setOffers([]);
        });
    };
    load();
    window.addEventListener("pc:offers-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("pc:offers-changed", load);
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = wanted ? offers.filter(offer => !offer.categorySlug || offer.categorySlug === wanted) : offers;
    return filtered.slice(0, limit);
  }, [offers, wanted, limit]);

  if (!visible.length) return null;

  return (
    <section className="pc-offers" aria-labelledby="pc-offers-title">
      <header className="pc-offers__head">
        <h2 id="pc-offers-title">
          <Tag aria-hidden="true" /> {title}
        </h2>
        <p>Preços promocionais verificados pela equipe do Preço Certo.</p>
      </header>
      <ul className="pc-offers__grid">
        {visible.map(offer => {
          const countdown = remaining(offer.endsAt);
          const discount =
            offer.regularPrice && offer.promoPrice && offer.regularPrice > offer.promoPrice
              ? Math.round((1 - offer.promoPrice / offer.regularPrice) * 100)
              : null;
          return (
            <li key={offer.id} className="pc-offers__card">
              <Link to={offer.linkUrl || "/buscar"} className="pc-offers__link">
                <OfferMedia imageUrl={offer.imageUrl} productName={offer.productName} discount={discount} />
                <span className="pc-offers__body">
                  <strong className="pc-offers__title">{offer.productName}</strong>
                  {offer.storeName && (
                    <span className="pc-offers__store">
                      <Store aria-hidden="true" /> {offer.storeName}
                    </span>
                  )}
                  <span className="pc-offers__prices">
                    <b>{offer.promoPrice !== null ? brl.format(offer.promoPrice) : "Consultar"}</b>
                    {offer.regularPrice !== null && <s>{brl.format(offer.regularPrice)}</s>}
                  </span>
                  {countdown && (
                    <span className="pc-offers__clock">
                      <Clock3 aria-hidden="true" /> {countdown}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CategoryOffers;
