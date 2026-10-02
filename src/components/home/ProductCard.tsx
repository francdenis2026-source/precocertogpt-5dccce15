import { memo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  ImageOff,
  Store,
  TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "../../data/catalog";
import { resolveProductImage } from "../../data/productImageResolver";
import { freshnessText, priceFreshness } from "../../lib/pricing";
import { ProductCardActions } from "../catalog/ProductCardActions";
import { PriceBadge } from "../catalog/PriceBadge";
import { PriceChangeBadge } from "../catalog/PriceChangeBadge";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const ProductCard = memo(function ProductCard({
  product,
}: {
  product: Product;
  featured?: boolean;
}) {
  const image = resolveProductImage(product);
  const [failedSource, setFailedSource] = useState("");
  const previous =
    product.previousPrice && product.previousPrice > product.minPrice
      ? product.previousPrice
      : product.avgPrice > product.minPrice
        ? product.avgPrice
        : undefined;
  const saving = previous ? previous - product.minPrice : 0;
  const storeCount = product.storeCount || 1;
  const freshness = priceFreshness(product.capturedAt, product.category);
  const freshnessLabel = freshnessText(freshness);

  return (
    <Link
      className="pcx-product"
      to={`/produto/${product.slug || product.id}`}
      aria-label={`Comparar preços de ${product.name}`}
    >
      <div className="pcx-product__image">
        <ProductCardActions product={product} className="pca-row--overlay" />
        {saving > 0 && (
          <span className="pcx-product__saving">
            <TrendingDown aria-hidden="true" /> Economize {brl.format(saving)}
          </span>
        )}
        {image && failedSource !== image ? (
          <img
            src={image}
            alt={product.name}
            width="220"
            height="220"
            loading="lazy"
            decoding="async"
            onError={() => setFailedSource(image)}
          />
        ) : (
          <span
            className="pcx-product__no-photo"
            role="img"
            aria-label={`Foto de ${product.name} indisponível`}
          >
            <ImageOff aria-hidden="true" />
            <small>Foto indisponível</small>
          </span>
        )}
      </div>

      <div className="pcx-product__body">
        <span className="pcx-product__category">
          {product.category || "Produto"}
        </span>
        <h3>{product.name}</h3>
        {product.size && product.size.trim() !== "-" && (
          <span className="pcx-product__meta">{product.size}</span>
        )}

        <div className="pcx-product__store">
          <Store aria-hidden="true" />
          <span>
            {product.establishment ||
              `${storeCount} ${storeCount === 1 ? "loja" : "lojas"} para comparar`}
          </span>
        </div>

        <div className="pcx-prices">
          {storeCount > 1 ? <PriceBadge tone="soft" /> : <span>Preço</span>}
          <div>
            {previous && <del>{brl.format(previous)}</del>}
            <strong>{brl.format(product.minPrice)}</strong>
          </div>
        </div>
        <PriceChangeBadge current={product.minPrice} previous={product.previousPrice} capturedAt={product.capturedAt} />

        <div className="pcx-product__footer">
          <time dateTime={product.capturedAt}>
            <Clock3 aria-hidden="true" /> {freshnessLabel}
          </time>
          <strong>
            Ver comparação <ArrowUpRight aria-hidden="true" />
          </strong>
        </div>
      </div>
    </Link>
  );
});
