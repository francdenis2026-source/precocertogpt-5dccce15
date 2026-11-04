import { type MouseEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Heart, LoaderCircle, ShoppingBasket, ShoppingCart } from "lucide-react";
import type { Product } from "../../data/catalog";
import { useFavorites } from "../../features/favorites/FavoritesProvider";
import { addToBasketWithAuthGuard } from "../../lib/basket";
import { useProductOnlineSales } from "../../lib/onlineSalesAvailability";
import "./ProductCardActions.css";

/**
 * Favoritar / adicionar à cesta / comprar online, direto no card — sem
 * precisar abrir nenhum modal. Usado nos cards da home, da busca e do
 * catálogo de cada estabelecimento, para que a ação esteja sempre à mão.
 * Os cards que a usam são inteiros clicáveis (Link ou button que abre um
 * modal), então cada botão aqui trava a propagação do clique para não
 * disparar a navegação ou a abertura do modal por baixo.
 */
export function ProductCardActions({
  product,
  className,
  showFavorite = true,
  showCart = true,
}: {
  product: Product;
  className?: string;
  /** Página de catálogo do estabelecimento já tem seu próprio favoritar/cesta
   *  (ProductCardQuickActions, injetado globalmente nos cards de
   *  .ref-product-grid) — aqui só entra o botão de comprar online, que
   *  aquele sistema não tem, para não duplicar o coração e a cesta. */
  showFavorite?: boolean;
  showCart?: boolean;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(product.id);
  const [addBusy, setAddBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const { canBuyOnline, merchantId } = useProductOnlineSales(product.id, product.establishmentId, product.establishmentSlug);

  const stop = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onFavorite = (event: MouseEvent) => {
    stop(event);
    void toggleFavorite(product.id);
  };

  const onAdd = async (event: MouseEvent) => {
    stop(event);
    if (addBusy) return;
    setAddBusy(true);
    const result = await addToBasketWithAuthGuard(product.id);
    setAddBusy(false);
    if (result === "auth-required") return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  if (!showFavorite && !showCart && !(canBuyOnline && merchantId)) return null;

  return (
    <div className={`pca-row${className ? ` ${className}` : ""}`} onClick={(event) => event.stopPropagation()}>
      {showFavorite && (
        <button
          type="button"
          className={`pca-btn${favorite ? " is-active is-favorite" : ""}`}
          onClick={onFavorite}
          aria-label={favorite ? "Remover dos favoritos" : "Favoritar"}
          aria-pressed={favorite}
        >
          <Heart aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
        </button>
      )}
      {showCart && (
        <button type="button" className={`pca-btn${added ? " is-active is-added" : ""}`} onClick={(event) => void onAdd(event)} aria-label="Adicionar à cesta" disabled={addBusy}>
          {addBusy ? <LoaderCircle aria-hidden="true" className="pca-spin" /> : added ? <Check aria-hidden="true" /> : <ShoppingBasket aria-hidden="true" />}
        </button>
      )}
      {canBuyOnline && merchantId && (
        <Link to={`/loja/${merchantId}`} className="pca-btn pca-btn--buy" onClick={(event) => event.stopPropagation()} aria-label="Comprar online nesta loja">
          <ShoppingCart aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
