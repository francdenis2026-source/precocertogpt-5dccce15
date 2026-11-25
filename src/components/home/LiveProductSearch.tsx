import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  PackageSearch,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Product } from "../../data/catalog";
import { resolveProductImage } from "../../data/productImageResolver";
import { suggestProducts } from "../../lib/productSearch";
import { formatCategoryLabel } from "../../lib/categoryLabels";
import { ProductQuickModal } from "./ProductQuickModal";
import { useFavorites } from "../../features/favorites/FavoritesProvider";
import { usePriceVisibility } from "../../hooks/usePriceVisibility";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const FREE_PREVIEW_LIMIT = 2;

type LiveProductSearchProps = {
  products: Product[];
  loading?: boolean;
  compact?: boolean;
  id: string;
  placeholder?: string;
};

export function LiveProductSearch({
  products,
  loading = false,
  compact = false,
  id,
  placeholder,
}: LiveProductSearchProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useFavorites();
  const { allPricesVisible } = usePriceVisibility();
  const isGuest = !userId && !allPricesVisible;
  const listId = `${useId().replace(/:/g, "")}-${id}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = query.trim();
  const suggestions = useMemo(
    () =>
      normalizedQuery.length >= 2
        ? suggestProducts(products, normalizedQuery, compact ? 8 : 10)
        : [],
    [compact, normalizedQuery, products],
  );
  const safeActiveIndex = activeIndex < suggestions.length ? activeIndex : -1;
  const showPanel = open && normalizedQuery.length >= 2;

  useEffect(() => {
    if (!compact) return;
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [compact]);

  const searchAll = () => {
    const value = normalizedQuery;
    setOpen(false);
    setActiveIndex(-1);
    navigate(value ? `/buscar?q=${encodeURIComponent(value)}` : "/buscar");
  };
  const openProduct = (product: Product) => {
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/produto/${product.slug || product.id}`);
  };
  const goToSignup = () => {
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/cadastro?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    searchAll();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(suggestions.length - 1);
    } else if (event.key === "Enter" && safeActiveIndex >= 0) {
      event.preventDefault();
      if (isGuest && safeActiveIndex >= FREE_PREVIEW_LIMIT) goToSignup();
      else openProduct(suggestions[safeActiveIndex]);
    }
  };

  return (
    <div
      ref={searchRef}
      className={`pc26-live-search${compact ? " pc26-live-search--compact" : ""}${showPanel ? " is-open" : ""}`}
    >
      <form
        className={compact ? "pc26-search" : "pc26-hero-search"}
        role="search"
        onSubmit={submit}
      >
        <Search className="pc26-live-search__icon" aria-hidden="true" />
        <label className="sr-only" htmlFor={id}>
          Produto para comparar
        </label>
        <input
          ref={inputRef}
          id={id}
          name="produto"
          role="combobox"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => undefined}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            (compact
              ? "Busque produto, marca ou categoria"
              : "Buscar produto ou marca")
          }
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel && suggestions.length > 0 ? listId : undefined}
          aria-activedescendant={
            showPanel && safeActiveIndex >= 0
              ? `${listId}-${safeActiveIndex}`
              : undefined
          }
        />
        {!query && compact ? (
          <span className="pc26-search__shortcut" aria-hidden="true">
            Ctrl K
          </span>
        ) : null}
        {query && (
          <button
            className="pc26-live-search__clear"
            type="button"
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Limpar busca"
          >
            <X aria-hidden="true" />
          </button>
        )}
        <button
          className="pc26-live-search__submit"
          type="submit"
          aria-label={compact ? "Buscar" : "Buscar preço"}
        >
          <span className="pc26-live-search__submit-label">
            {compact ? "Buscar" : "Buscar preço"}
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      </form>
      {showPanel && (
        <div
          className="pcx-search-panel"
        >
          <div className="pcx-search-panel__head">
            <span>Produtos encontrados</span>
            <div className="pcx-search-panel__head-actions">
              <small>
                {loading
                  ? "Atualizando catálogo…"
                  : `${suggestions.length} ${suggestions.length === 1 ? "produto" : "produtos"}`}
              </small>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                aria-label="Fechar resultados da busca"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>
          {loading && !products.length ? (
            <div className="pcx-search-panel__state">
              <LoaderCircle
                className="pcx-search-panel__loader"
                aria-hidden="true"
              />
              <span>Consultando preços locais…</span>
            </div>
          ) : suggestions.length ? (
            <div id={listId} className="pcx-search-panel__list" role="listbox" aria-label="Sugestões de produtos">
              {suggestions.map((product, index) => {
                const image = resolveProductImage(product);
                const locked = isGuest && index >= FREE_PREVIEW_LIMIT;
                return (
                  <button
                    id={`${listId}-${index}`}
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={index === safeActiveIndex}
                    className={`${index === safeActiveIndex ? "is-active" : ""}${locked ? " pcx-search-panel__item--teaser" : ""}`}
                    onPointerMove={(event) => {
                      if (event.pointerType === "mouse") setActiveIndex(index);
                    }}
                    onClick={() => {
                      if (locked) return goToSignup();
                      setOpen(false);
                      setActiveIndex(-1);
                      setQuickProduct(product);
                    }}
                  >
                    <span className="pcx-search-panel__thumb">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          width="52"
                          height="52"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <PackageSearch aria-hidden="true" />
                      )}
                    </span>
                    <span className="pcx-search-panel__copy">
                      <strong>{product.name}</strong>
                      <small>
                        {[product.brand, product.size && product.size.trim() !== "-" ? product.size : formatCategoryLabel(product.category)]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      <em
                        style={
                          {
                            "--pc26-store-accent":
                              product.storeColor || "#2563eb",
                          } as CSSProperties
                        }
                      >
                        <i aria-hidden="true" />
                        {product.establishment || "Comércio local"}
                      </em>
                    </span>
                    {locked ? (
                      <span className="pcx-search-panel__price pcx-search-panel__price--blurred">
                        <small>a partir de</small>
                        <strong>{brl.format(product.minPrice)}</strong>
                      </span>
                    ) : (
                      <span className="pcx-search-panel__price">
                        <small>a partir de</small>
                        <strong>{brl.format(product.minPrice)}</strong>
                      </span>
                    )}
                    {locked && (
                      <i className="pcx-search-panel__lock">
                        <LockKeyhole aria-hidden="true" />
                      </i>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pcx-search-panel__state">
              <PackageSearch aria-hidden="true" />
              <span>
                <strong>Nenhum produto encontrado</strong>
                <small>Tente um nome mais curto ou outra marca.</small>
              </span>
            </div>
          )}
          {!loading && suggestions.length > 0 && (
            isGuest && suggestions.length > FREE_PREVIEW_LIMIT ? (
              <button
                className="pcx-search-panel__all pcx-search-panel__all--gate"
                type="button"
                onClick={goToSignup}
              >
                <UserPlus aria-hidden="true" />
                Criar conta grátis para ver todos os preços
              </button>
            ) : (
              <button
                className="pcx-search-panel__all"
                type="button"
                onClick={searchAll}
              >
                Ver todos para “{normalizedQuery}”{" "}
                <ArrowRight aria-hidden="true" />
              </button>
            )
          )}
        </div>
      )}
      {quickProduct && <ProductQuickModal product={quickProduct} onClose={() => setQuickProduct(null)} />}
      <span className="sr-only" role="status" aria-live="polite">
        {showPanel && !loading
          ? `${suggestions.length} sugestões disponíveis`
          : ""}
      </span>
    </div>
  );
}
