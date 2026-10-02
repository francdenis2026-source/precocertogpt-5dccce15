import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, ChevronRight, Factory, Heart, Home,
  Info, Layers3, MapPin, Package, PackageSearch, PiggyBank, RadioTower, RefreshCw,
  ShieldCheck, ShoppingBasket, Store, Tag, TrendingDown, TrendingUp,
} from "lucide-react";
import { fetchCatalog } from "../data/remoteCatalog";
import type { CatalogPayload, Product } from "../data/catalog";
import { useFavorites } from "../features/favorites/FavoritesProvider";
import { supabase } from "../lib/supabase";
import { addToBasketWithAuthGuard, type BasketEntry, readBasket } from "../lib/basket";
import { getCachedAvailability, useProductOnlineSales } from "../lib/onlineSalesAvailability";
import { trackProductView } from "../lib/analytics";
import { buildComparableOffers, findComparableProducts, type ComparableOffer } from "../lib/productSearch";
import { ProductThumb } from "../components/catalog/ProductThumb";
import { PriceChangeBadge } from "../components/catalog/PriceChangeBadge";
import { PublicFooter, PublicHeader } from "./PublicChrome";
import "./ProductDetailLive2026.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function cleanValue(value?: string | null, fallback = "Não informado") {
  const text = (value || "").trim();
  if (!text || text === "-" || text === "—" || text.toLocaleLowerCase("pt-BR") === "não identificada") return fallback;
  return text;
}

function formatDate(value?: string) {
  if (!value) return "Verificado recentemente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Verificado recentemente";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

const formatClock = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);

/**
 * Tela de produto compacta, com faixa hero, comparação de preços em tempo real
 * (assinatura Realtime na tabela `prices`) e um único rodapé institucional.
 */
export function ProductDetailLive2026() {
  const { identifier = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [basket, setBasket] = useState<BasketEntry[]>([]);
  const [message, setMessage] = useState("");
  const [extra, setExtra] = useState({ manufacturer: "", barcode: "" });
  const [liveAt, setLiveAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const [showMobileBar, setShowMobileBar] = useState(false);

  const loadCatalog = useCallback(async (force = false) => {
    if (force) setSyncing(true);
    try {
      const data = await fetchCatalog("", { force });
      setCatalog(data);
      if (force) setLiveAt(new Date());
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog(false);
    setBasket(readBasket());
    const sync = () => setBasket(readBasket());
    window.addEventListener("pc:basket-changed", sync);
    return () => window.removeEventListener("pc:basket-changed", sync);
  }, [loadCatalog]);

  /**
   * Tempo real: qualquer alteração de preço no banco recarrega o catálogo com
   * `force`, invalidando o cache. O debounce evita rajadas quando o painel
   * administrativo grava vários preços em sequência.
   */
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("pdl-live-prices")
      .on("postgres_changes", { event: "*", schema: "public", table: "prices" }, () => {
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => void loadCatalog(true), 900);
      })
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase?.removeChannel(channel);
    };
  }, [loadCatalog]);

  const product = useMemo(
    () => catalog?.products.find(item => String(item.id) === identifier || item.slug === identifier),
    [catalog, identifier],
  );

  // Só usado para garantir que o mapa de disponibilidade carregue nesta
  // página; a leitura de fato usa getCachedAvailability com o estabelecimento
  // realmente exibido (que muda conforme a oferta selecionada abaixo).
  useProductOnlineSales(product?.id ?? "", product?.establishmentId ?? "", product?.establishmentSlug);

  /**
   * A barra fixa de preço no mobile só faz sentido depois que o botão
   * "Adicionar à lista" do hero sai da tela — mostrar as duas ao mesmo tempo
   * (o que acontecia antes, sempre visível) duplicava preço e CTA na
   * primeira dobra e passava a impressão de tela bagunçada.
   */
  useEffect(() => {
    const target = primaryActionRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      setShowMobileBar(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileBar(!entry.isIntersecting),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, product?.id]);

  useEffect(() => {
    if (!product?.slug || !identifier || identifier === product.slug) return;
    navigate(`/produto/${product.slug}`, { replace: true });
  }, [identifier, navigate, product?.slug]);

  // Alimenta "produtos mais buscados": conta a visualização uma vez por
  // produto resolvido, independente de o visitante estar logado ou não.
  useEffect(() => {
    if (product?.id) trackProductView(String(product.id));
  }, [product?.id]);

  // SeoRouteManager só conhece rotas estáticas e cai num título genérico
  // ("Produto | PreçoCerto") para /produto/:id — aqui sobrescrevemos com o
  // nome real assim que o catálogo carrega, já que esse efeito roda depois.
  useEffect(() => {
    if (!product) return;
    const title = `${product.name} | PreçoCerto`;
    const description = `Compare o preço de ${product.name} entre estabelecimentos de Feijó (AC) a partir de ${brl.format(product.minPrice)}.`;
    document.title = title;
    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  }, [product]);

  useEffect(() => {
    if (!product || !supabase) return;
    let active = true;
    void supabase.from("products").select("manufacturer, barcode").eq("id", String(product.id)).maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const row = data as { manufacturer?: string | null; barcode?: string | null };
        setExtra({ manufacturer: cleanValue(row.manufacturer, ""), barcode: cleanValue(row.barcode, "") });
      });
    return () => { active = false; };
  }, [product]);

  const comparison = useMemo(
    () => (!product || !catalog ? [] : buildComparableOffers(catalog.products, product)),
    [catalog, product],
  );

  /** Uma linha por estabelecimento, sempre com o menor preço equivalente da loja. */
  const storeOffers = useMemo(() => {
    const cheapest = new Map<string, ComparableOffer>();
    comparison.forEach(offer => {
      if (!Number.isFinite(offer.value) || offer.value <= 0) return;
      const key = String(offer.establishmentId || offer.establishment);
      const current = cheapest.get(key);
      if (!current || offer.value < current.value) cheapest.set(key, offer);
    });
    return Array.from(cheapest.values()).sort((a, b) => a.value - b.value);
  }, [comparison]);

  const similar = useMemo(
    () => (!product || !catalog ? [] : findComparableProducts(catalog.products, product, 4)),
    [catalog, product],
  );

  const addToBasket = async (target: Product) => {
    const result = await addToBasketWithAuthGuard(target.id);
    if (result === "auth-required") return;
    setMessage(result === "exists" ? "Produto já está na sua lista." : "Produto adicionado à sua lista.");
    window.setTimeout(() => setMessage(""), 2200);
  };

  if (loading) {
    return (
      <main className="pdl-skeleton" role="status" aria-live="polite">
        <span className="pdl-sr">Carregando produto…</span>
        <span className="pdl-skeleton__band" />
        <div className="pdl-skeleton__grid">
          <span className="pdl-skeleton__panel" />
          <span className="pdl-skeleton__panel" />
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="pdl-state">
        <PackageSearch aria-hidden="true" />
        <h1>Produto não encontrado</h1>
        <p>Este item pode ter sido atualizado ou removido do catálogo.</p>
        <Link to="/buscar">Voltar para a busca</Link>
      </main>
    );
  }

  const selectedId = searchParams.get("oferta");
  const selected = selectedId ? storeOffers.find(offer => String(offer.establishmentId) === selectedId) : undefined;
  const displayed = selected || storeOffers[0];
  const displayedProduct = displayed && catalog?.products.find(item => String(item.id) === String(displayed.productId));
  const price = displayed?.value ?? product.minPrice;
  const maxPrice = storeOffers.length ? storeOffers[storeOffers.length - 1].value : price;
  const average = storeOffers.length
    ? storeOffers.reduce((total, offer) => total + offer.value, 0) / storeOffers.length
    : price;
  const spread = storeOffers.length > 1 ? Math.max(0, maxPrice - storeOffers[0].value) : 0;
  const single = storeOffers.length <= 1;
  const previous = Number(displayed?.previousPrice || displayedProduct?.previousPrice || 0);
  const dropped = previous > price ? previous - price : 0;
  const favorite = isFavorite(product.id);
  const basketTarget = displayedProduct || product;
  const inBasket = basket.some(item => item.productId === String(basketTarget.id));
  const storeHref = displayed
    ? `/estabelecimento/${displayed.establishmentSlug || displayed.establishmentId}`
    : "/estabelecimentos";
  const displayedEstablishmentId = displayed?.establishmentId ?? product.establishmentId;
  const onlineStore = getCachedAvailability(displayedEstablishmentId);
  const canBuyDisplayedOnline = Boolean(onlineStore?.serviceLive && onlineStore.activeProductIds.has(String(basketTarget.id)));

  return (
    <div className="pdl-page">
      <PublicHeader />

      <main id="conteudo-principal" className="pdl-main">
        <section className="pdl-hero">
          <nav className="pdl-crumbs" aria-label="Navegação estrutural">
            <Link to="/"><Home aria-hidden="true" /><span>Início</span></Link>
            <ChevronRight aria-hidden="true" />
            <Link to={`/buscar?q=${encodeURIComponent(product.category)}`}>{product.category}</Link>
            <ChevronRight aria-hidden="true" />
            <span>{product.name}</span>
          </nav>

          <div className="pdl-hero__grid">
            <div className="pdl-hero__copy">
              <div className="pdl-hero__tags">
                <span className="pdl-live" data-syncing={syncing ? "true" : "false"}>
                  <RadioTower aria-hidden="true" />
                  {syncing ? "Sincronizando com o banco…" : single ? "Preço monitorado em tempo real" : `Comparando ${storeOffers.length} estabelecimentos`}
                  {liveAt && !syncing && <small>· {formatClock(liveAt)}</small>}
                </span>
                <span className="pdl-chip"><Tag aria-hidden="true" />{cleanValue(product.brand, product.category)}</span>
              </div>
              <h1>{product.name}</h1>
              <p>{cleanValue(product.size, "") || cleanValue(product.unit, "") || "Embalagem não informada"} · {product.category}</p>

              <div className="pdl-price">
                <div>
                  <small>{single ? "PREÇO REGISTRADO" : selected ? "OFERTA SELECIONADA" : "MENOR PREÇO ENCONTRADO"}</small>
                  <strong>{brl.format(price)}</strong>
                  <Link to={storeHref}><Store aria-hidden="true" />{displayed?.establishment || product.establishment}</Link>
                </div>
                {!single && spread > 0 && (price > storeOffers[0].value ? (
                  <span className="pdl-price__save"><TrendingUp aria-hidden="true" />{brl.format(price - storeOffers[0].value)} acima do menor preço</span>
                ) : (
                  <span className="pdl-price__save"><PiggyBank aria-hidden="true" />Economize até {brl.format(spread)}</span>
                ))}
                {dropped > 0 && (
                  <span className="pdl-price__save"><TrendingDown aria-hidden="true" />{brl.format(dropped)} abaixo do preço anterior</span>
                )}
                {previous > 0 && previous < price && (
                  <PriceChangeBadge current={price} previous={previous} capturedAt={displayed?.capturedAt} />
                )}
              </div>

              {canBuyDisplayedOnline && onlineStore && (
                <Link className="pdl-buy-online" to={`/loja/${onlineStore.merchantId}`}>
                  <ShoppingBasket aria-hidden="true" />Comprar online nesta loja
                </Link>
              )}

              <div className="pdl-actions">
                <button ref={primaryActionRef} type="button" className="pdl-actions__primary" onClick={() => void addToBasket(basketTarget)}>
                  <ShoppingBasket aria-hidden="true" />{inBasket ? "Na sua lista, abrir cesta" : "Adicionar à lista"}
                </button>
                <button type="button" className={favorite ? "is-active" : ""} onClick={() => void toggleFavorite(product.id)} aria-pressed={favorite}>
                  <Heart aria-hidden="true" fill={favorite ? "currentColor" : "none"} />{favorite ? "Salvo" : "Salvar"}
                </button>
                <button type="button" className="pdl-actions__ghost" onClick={() => void loadCatalog(true)} disabled={syncing}>
                  <RefreshCw aria-hidden="true" />Atualizar preços
                </button>
              </div>
            </div>

            <figure className="pdl-hero__visual">
              <ProductThumb product={product} size="lg" eager />
              <figcaption><ShieldCheck aria-hidden="true" />Imagem informativa, embalagem pode variar</figcaption>
            </figure>
          </div>
        </section>

        <section className="pdl-facts" aria-label="Resumo de preços">
          <span><small>Menor preço</small><b>{brl.format(storeOffers[0]?.value ?? price)}</b></span>
          <span><small>Preço médio</small><b>{brl.format(average)}</b></span>
          <span><small>Maior preço</small><b>{brl.format(maxPrice)}</b></span>
          <span><small>Última verificação</small><b>{formatDate(displayed?.capturedAt || product.updated_at || product.capturedAt)}</b></span>
        </section>

        <div className="pdl-columns">
          <section className="pdl-card pdl-compare" aria-labelledby="pdl-compare-title">
            <header>
              <div>
                <small>COMPARAÇÃO EM TEMPO REAL</small>
                <h2 id="pdl-compare-title">{single ? "Onde encontrar" : "Preço por estabelecimento"}</h2>
              </div>
              <Link to="/cidades"><MapPin aria-hidden="true" />Lojas por cidade</Link>
            </header>
            <ol className="pdl-compare__list">
              {storeOffers.map((offer, index) => {
                const active = String(displayed?.establishmentId) === String(offer.establishmentId);
                return (
                  <li key={`${offer.establishmentId}-${offer.productId}`} className={`${index === 0 ? "is-best" : ""}${active ? " is-active" : ""}`}>
                    <Link to={`/produto/${offer.productSlug || offer.productId}?oferta=${encodeURIComponent(String(offer.establishmentId))}`} aria-current={active ? "true" : undefined}>
                      <span className="pdl-compare__rank">{index === 0 ? <BadgeCheck aria-hidden="true" /> : index + 1}</span>
                      <span className="pdl-compare__store">
                        <strong>{offer.establishment}</strong>
                        <small>{offer.neighborhood || "Feijó"} · {offer.productBrand || "marca não informada"}</small>
                      </span>
                      <span className="pdl-compare__bar" aria-hidden="true">
                        <i style={{ width: `${Math.max(10, (offer.value / (maxPrice || offer.value)) * 100)}%` }} />
                      </span>
                      <span className="pdl-compare__price">
                        <b>{brl.format(offer.value)}</b>
                        <small>{formatDate(offer.capturedAt)}</small>
                        <PriceChangeBadge current={offer.value} previous={offer.previousPrice} capturedAt={offer.capturedAt} />
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
              {!storeOffers.length && <li className="pdl-compare__empty">Nenhum preço publicado para este item ainda.</li>}
            </ol>
          </section>

          <aside className="pdl-side">
            <details className="pdl-card pdl-sheet" open>
              <summary><span><Info aria-hidden="true" />Ficha do produto</span><ChevronRight aria-hidden="true" /></summary>
              <dl>
                <div><dt><Tag aria-hidden="true" />Marca</dt><dd>{cleanValue(product.brand)}</dd></div>
                <div><dt><Factory aria-hidden="true" />Fabricante</dt><dd>{cleanValue(extra.manufacturer)}</dd></div>
                <div><dt><Layers3 aria-hidden="true" />Categoria</dt><dd>{product.category}</dd></div>
                <div><dt><Package aria-hidden="true" />Embalagem</dt><dd>{cleanValue(product.size, "") || cleanValue(product.unit, "") || "Não informada"}</dd></div>
                <div><dt><BadgeCheck aria-hidden="true" />Código de barras</dt><dd>{cleanValue(extra.barcode || product.barcode)}</dd></div>
                <div><dt><CalendarDays aria-hidden="true" />Atualizado</dt><dd>{formatDate(product.updated_at || product.capturedAt)}</dd></div>
              </dl>
            </details>

            <section className="pdl-card pdl-similar" aria-labelledby="pdl-similar-title">
              <header><div><small>ALTERNATIVAS</small><h2 id="pdl-similar-title">Produtos similares</h2></div></header>
              {similar.length ? (
                <ul>
                  {similar.map(item => (
                    <li key={item.id}>
                      <Link to={`/produto/${item.slug || item.id}`}>
                        <ProductThumb product={item} size="sm" className="pdl-similar__thumb" />
                        <span><strong>{item.name}</strong><small>{cleanValue(item.brand)} · {item.size || item.unit}</small></span>
                        <b>{brl.format(item.minPrice)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pdl-empty">Nenhum similar disponível nesta categoria.</p>
              )}
            </section>

            <p className="pdl-note">
              <ShieldCheck aria-hidden="true" />
              Preços organizados pelo PreçoCerto a partir do banco de dados dos estabelecimentos. Confirme disponibilidade na loja.
            </p>
          </aside>
        </div>

        <nav className="pdl-back" aria-label="Voltar">
          <Link to="/"><ArrowLeft aria-hidden="true" />Voltar para a homepage</Link>
          <Link to="/buscar">Buscar outro produto <ArrowRight aria-hidden="true" /></Link>
        </nav>
      </main>

      <PublicFooter />

      <div className={`pdl-mobile-bar${showMobileBar ? " is-visible" : ""}`} aria-hidden={!showMobileBar}>
        <div><small>{single ? "Preço registrado" : "Menor preço"}</small><strong>{brl.format(price)}</strong></div>
        <button type="button" tabIndex={showMobileBar ? 0 : -1} onClick={() => void addToBasket(basketTarget)}>
          <ShoppingBasket aria-hidden="true" />{inBasket ? "Na lista" : "Adicionar"}
        </button>
      </div>
      {message && <div className="pdl-toast" role="status" aria-live="polite">{message}</div>}
    </div>
  );
}

export default ProductDetailLive2026;
