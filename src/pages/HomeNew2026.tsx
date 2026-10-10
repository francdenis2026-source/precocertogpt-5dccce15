import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ImageOff,
  ListChecks,
  Lock,
  MapPin,
  Search,
  Sparkles,
  Store as StoreIcon,
  TrendingDown,
  WifiOff,
  X,
} from "lucide-react";
import {
  buildCatalog,
  type CatalogPayload,
  type Product,
  type StoreRow,
  verifiedDatasetMetrics,
} from "../data/catalog";
import { fetchSectorCatalog, getCachedSectorCatalog } from "../data/sectorCatalog";
import { buildFeatured, currentCycle, msUntilNextCycle } from "../data/featuredRotation";
import { hasProfessionalProductPhoto, resolveProductImage } from "../data/productImageResolver";
import { getStoreLogoUrl } from "../data/storeLogos";
import { freshnessText, priceFreshness } from "../lib/pricing";
import { useAuth } from "../auth/AuthProvider";
import { usePriceVisibility } from "../hooks/usePriceVisibility";
import { AppDock } from "../reference/PublicChrome";
import { Footer } from "../components/home/Footer";
import { Header } from "../components/home/Header";
import { LiveProductSearch } from "../components/home/LiveProductSearch";
import { ProductCardActions } from "../components/catalog/ProductCardActions";
import "./HomeProfessionalRedesign2026.css";
import "./HomePreco2026.css";

const initialCatalog = buildCatalog();
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");
const QUICK_TERMS = ["Arroz", "Feijão", "Café", "Leite", "Açúcar", "Óleo"];

const productHref = (product: Product) => `/produto/${product.slug || product.id}`;
const spread = (product: Product) => Math.max(0, product.maxPrice - product.minPrice);

const FREE_OFFERS = 4;
const FREE_BOARD_ROWS = 2;
const FREE_STORES = 4;
const SIGNUP_HREF = "/cadastro?redirect=%2F";
const MASKED_PRICE = "R$ 00,00";

/** Visitante = sem conta e sem a chave "todos os preços visíveis" do admin
 *  (a mesma regra da busca). Enquanto a sessão carrega ninguém é bloqueado,
 *  para quem já tem conta não ver o borrão piscar. */
function useIsGuest() {
  const { user, loading } = useAuth();
  const { allPricesVisible, loading: pricesLoading } = usePriceVisibility();
  return !loading && !pricesLoading && !user && !allPricesVisible;
}

/** Véu do borrão: cobre o bloco travado e convida a criar a conta. */
function LockVeil({ title, text }: { title: string; text: string }) {
  return (
    <div className="ph-lock__veil">
      <div className="ph-lock__card" role="group" aria-label={title}>
        <span className="ph-lock__icon" aria-hidden="true"><Lock /></span>
        <h3>{title}</h3>
        <p>{text}</p>
        <Link className="ph-btn ph-btn--primary" to={SIGNUP_HREF}>Criar conta grátis <ArrowRight aria-hidden="true" /></Link>
        <Link className="ph-lock__login" to="/login?redirect=%2F">Já tenho conta · Entrar</Link>
      </div>
    </div>
  );
}

function ProductThumb({ product, size }: { product: Product; size: number }) {
  const image = resolveProductImage(product);
  const storeLogo = getStoreLogoUrl(product.establishment || "");
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  if (image && !imageFailed) {
    return <span className="ph-thumb"><img src={image} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setImageFailed(true)} /></span>;
  }
  // Sem foto do produto: logo do estabelecimento (nunca uma letra solta).
  if (storeLogo && !logoFailed) {
    return <span className="ph-thumb ph-thumb--logo" role="img" aria-label={`Logo de ${product.establishment}`}><img src={storeLogo} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setLogoFailed(true)} /></span>;
  }
  return <span className="ph-thumb ph-thumb--empty" role="img" aria-label={`Foto de ${product.name} indisponível`}>{size >= 100 ? <ImageOff aria-hidden="true" /> : <StoreIcon aria-hidden="true" />}</span>;
}

function StoreMark({ store }: { store: StoreRow }) {
  const logo = getStoreLogoUrl(store.name);
  const [failed, setFailed] = useState(false);
  if (logo && !failed) return <span className="ph-store__mark"><img src={logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /></span>;
  return <span className="ph-store__mark ph-store__mark--text" aria-hidden="true"><StoreIcon /></span>;
}

/** "Menor preço agora": produtos com maior diferença real entre a loja mais
 *  barata e a mais cara — é a prova do que o PreçoCerto faz, na primeira tela. */
function BestPriceBoard({ products, loading, guest }: { products: Product[]; loading: boolean; guest: boolean }) {
  return (
    <section className="ph-board" aria-labelledby="ph-board-title">
      <header className="ph-board__head">
        <h2 id="ph-board-title"><TrendingDown aria-hidden="true" /> Menor preço agora</h2>
        <Link to="/buscar?ordem=stores">Ver todos</Link>
      </header>
      {loading && !products.length ? (
        <ol className="ph-board__list" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => <li key={index} className="ph-board__row ph-skeleton" />)}
        </ol>
      ) : products.length ? (
        <ol className="ph-board__list">
          {products.map((product, index) => {
            const locked = guest && index >= FREE_BOARD_ROWS;
            return (
            <li key={product.id}>
              <Link className={`ph-board__row${locked ? " is-locked" : ""}`} to={locked ? SIGNUP_HREF : productHref(product)} aria-label={locked ? `${product.name}: crie sua conta grátis para ver o preço` : undefined}>
                <ProductThumb product={product} size={48} />
                <span className="ph-board__info">
                  <strong>{product.name}</strong>
                  <small><StoreIcon aria-hidden="true" /> {product.establishment || `${product.storeCount} lojas`}</small>
                </span>
                {locked ? (
                  <span className="ph-board__price ph-board__price--locked">
                    <strong aria-hidden="true">{MASKED_PRICE}</strong>
                    <small><Lock aria-hidden="true" />Ver preço</small>
                  </span>
                ) : (
                  <span className="ph-board__price">
                    <strong>{brl.format(product.minPrice)}</strong>
                    {spread(product) > 0 && <small aria-label={`${brl.format(spread(product))} mais barato que a loja mais cara`}><TrendingDown aria-hidden="true" />{brl.format(spread(product))}</small>}
                  </span>
                )}
              </Link>
            </li>
            );
          })}
        </ol>
      ) : (
        <p className="ph-board__empty">Os preços estão sendo atualizados. <Link to="/buscar">Pesquise o catálogo</Link></p>
      )}
      <p className="ph-board__note">Diferença calculada entre a loja mais barata e a mais cara de Feijó.</p>
    </section>
  );
}

/** Card travado: mantém nome e foto, mas o preço real nem entra no HTML. */
function LockedOfferCard({ product }: { product: Product }) {
  return (
    <article className="ph-offer ph-offer--locked" aria-hidden="true">
      <span className="ph-offer__link">
        <span className="ph-offer__media"><ProductThumb product={product} size={200} /></span>
        <span className="ph-offer__store"><StoreIcon aria-hidden="true" /><span>{product.establishment || "Estabelecimento"}</span></span>
        <span className="ph-offer__name">{product.name}</span>
        {product.size && product.size.trim() !== "-" && <span className="ph-offer__size">{product.size}</span>}
        <span className="ph-offer__price"><small>a partir de</small><strong>{MASKED_PRICE}</strong><del>{MASKED_PRICE}</del></span>
        <span className="ph-offer__save"><TrendingDown aria-hidden="true" /> Economize {MASKED_PRICE}</span>
        <span className="ph-offer__foot"><span>Compare {product.storeCount} lojas</span><ArrowRight aria-hidden="true" /></span>
      </span>
    </article>
  );
}

/** Linha da loja: logo pequeno + nome (ou ícone, nunca uma letra). */
function StoreLine({ name }: { name: string }) {
  const logo = getStoreLogoUrl(name);
  const [failed, setFailed] = useState(false);
  return (
    <span className="ph-offer__store">
      {logo && !failed
        ? <img src={logo} alt="" width="18" height="18" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <StoreIcon aria-hidden="true" />}
      <span>{name || "Vários estabelecimentos"}</span>
    </span>
  );
}

function OfferCard({ product }: { product: Product }) {
  const saving = spread(product);
  const percent = product.maxPrice > 0 ? Math.round((saving / product.maxPrice) * 100) : 0;
  const freshness = priceFreshness(product.capturedAt, product.category);
  // "Preço expirado" só confundia: o aviso de frescor aparece apenas quando o preço está em dia.
  const showFresh = freshness.state !== "expired" && freshness.state !== "aging";
  return (
    <article className="ph-offer">
      <ProductCardActions product={product} className="ph-offer__actions" />
      <Link to={productHref(product)} className="ph-offer__link" aria-label={`Comparar preços de ${product.name}`}>
        <span className="ph-offer__media">
          <ProductThumb product={product} size={200} />
          {percent >= 5 && <span className="ph-offer__badge">-{percent}%</span>}
        </span>
        <StoreLine name={product.establishment} />
        <span className="ph-offer__name">{product.name}</span>
        {product.size && product.size.trim() !== "-" && <span className="ph-offer__size">{product.size}</span>}
        <span className="ph-offer__price">
          <small>a partir de</small>
          <strong>{brl.format(product.minPrice)}</strong>
          {saving > 0 && <del>{brl.format(product.maxPrice)}</del>}
        </span>
        {saving > 0 && <span className="ph-offer__save"><TrendingDown aria-hidden="true" /> Economize {brl.format(saving)}</span>}
        <span className="ph-offer__foot">
          <span>{product.storeCount > 1 ? `Compare ${product.storeCount} lojas` : "1 loja"}</span>
          {showFresh ? <time dateTime={product.capturedAt}>{freshnessText(freshness)}</time> : <ArrowRight aria-hidden="true" />}
        </span>
      </Link>
    </article>
  );
}

export function HomeNew2026() {
  const [snapshot] = useState(getCachedSectorCatalog);
  const [catalog, setCatalog] = useState<CatalogPayload>(() => snapshot ?? { ...initialCatalog, metrics: verifiedDatasetMetrics });
  const [loading, setLoading] = useState(!snapshot);
  const [cycle, setCycle] = useState(() => currentCycle());
  // Uma atualização que falha mantém o último catálogo visível, com aviso.
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncNoticeDismissed, setSyncNoticeDismissed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setSyncFailed(false);
      try {
        const value = await fetchSectorCatalog(loadAttempt > 0);
        if (active) setCatalog(value);
      } catch {
        if (active) setSyncFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCycle(currentCycle()), msUntilNextCycle() + 250);
    return () => window.clearTimeout(timer);
  }, [cycle]);

  const products = useMemo(() => catalog.products.filter(product => product.minPrice > 0), [catalog.products]);
  const featured = useMemo(() => buildFeatured(products, cycle, 8), [products, cycle]);
  const board = useMemo(
    () => products.filter(product => product.storeCount > 1 && spread(product) > 0 && hasProfessionalProductPhoto(product)).sort((a, b) => spread(b) - spread(a)).slice(0, 5),
    [products],
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [products]);
  const stores = useMemo(() => [...catalog.stores].sort((a, b) => b.products - a.products).slice(0, 8), [catalog.stores]);
  const latest = useMemo(() => {
    const times = products.map(product => Date.parse(product.capturedAt)).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [products]);

  const guest = useIsGuest();
  const productCount = catalog.metrics.products || products.length;
  const storeCount = catalog.stores.length;

  return (
    <div className="ph">
      <Header products={products} />
      {syncFailed && !syncNoticeDismissed && (
        <div className="pcx-sync-notice" role="status" aria-live="polite">
          <WifiOff aria-hidden="true" />
          <span>Não foi possível confirmar preços mais recentes agora. Mostrando o último catálogo salvo.</span>
          <button type="button" className="pcx-sync-notice__retry" onClick={() => setLoadAttempt(value => value + 1)}>Tentar novamente</button>
          <button type="button" className="pcx-sync-notice__dismiss" onClick={() => setSyncNoticeDismissed(true)} aria-label="Dispensar aviso"><X aria-hidden="true" /></button>
        </div>
      )}

      <main id="conteudo-principal">
        <section className="ph-hero" aria-labelledby="ph-hero-title">
          {/* Foto editorial: parede clara à esquerda recebe o texto sem véu nem
              vidro; a compra (sacola, arroz, café, leite, celular) fica à direita. */}
          <img
            className="ph-hero__bg"
            src="/editorial-2026/home-shopping-1280.webp"
            srcSet="/editorial-2026/home-shopping-640.webp 640w, /editorial-2026/home-shopping-1280.webp 1280w"
            sizes="100vw"
            alt=""
            width="1280"
            height="853"
            fetchPriority="high"
            decoding="async"
          />
          <div className="ph-wrap ph-hero__inner">
            <div className="ph-hero__copy">
              <p className="ph-hero__place"><MapPin aria-hidden="true" /> Feijó, Acre</p>
              <h1 id="ph-hero-title">Quanto custa em Feijó <span>hoje?</span></h1>
              <p className="ph-hero__lede">Pesquise um produto e veja, loja por loja, onde ele está mais barato antes de sair de casa.</p>
              <div className="ph-hero__search">
                <LiveProductSearch products={products} loading={loading} id="ph-hero" placeholder="Busque arroz, café, fralda, cimento…" />
              </div>
              <nav className="ph-hero__quick" aria-label="Buscas populares">
                {QUICK_TERMS.map(term => <Link key={term} to={`/buscar?q=${encodeURIComponent(term)}`}><Search aria-hidden="true" />{term}</Link>)}
              </nav>
              <dl className="ph-hero__facts">
                <div><dt>Produtos</dt><dd>{productCount ? integer.format(productCount) : "—"}</dd></div>
                <div><dt>Lojas</dt><dd>{storeCount ? integer.format(storeCount) : "—"}</dd></div>
                <div><dt>Última atualização</dt><dd>{latest ? latest.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</dd></div>
              </dl>
            </div>
          </div>
        </section>
        <div className="ph-wrap ph-board-strip">
          <BestPriceBoard products={board} loading={loading} guest={guest} />
        </div>

        {categories.length > 0 && (
          <section className="ph-section ph-wrap" aria-labelledby="ph-cat-title">
            <header className="ph-section__head">
              <h2 id="ph-cat-title">Navegue por categoria</h2>
              <Link to="/explorar">Todas as categorias <ArrowRight aria-hidden="true" /></Link>
            </header>
            <ul className="ph-cats">
              {categories.map(([name, count]) => (
                <li key={name}><Link to={`/buscar?categoria=${encodeURIComponent(name)}`}><span>{name}</span><small>{integer.format(count)}</small></Link></li>
              ))}
            </ul>
          </section>
        )}

        <section className="ph-section ph-wrap" aria-labelledby="ph-offers-title">
          <header className="ph-section__head">
            <div>
              <h2 id="ph-offers-title">Ofertas de hoje</h2>
              <p>Seleção que muda ao longo do dia, sempre com o menor preço encontrado.</p>
            </div>
            <Link to="/buscar">Ver catálogo <ArrowRight aria-hidden="true" /></Link>
          </header>
          {loading && !featured.length ? (
            <div className="ph-offers" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div key={index} className="ph-offer ph-skeleton" />)}</div>
          ) : featured.length ? (
            <>
              <div className="ph-offers">{featured.slice(0, guest ? FREE_OFFERS : featured.length).map(product => <OfferCard key={product.id} product={product} />)}</div>
              {guest && featured.length > FREE_OFFERS && (
                <div className="ph-lock">
                  <div className="ph-offers ph-lock__content" inert aria-hidden="true">{featured.slice(FREE_OFFERS).map(product => <LockedOfferCard key={product.id} product={product} />)}</div>
                  <LockVeil title="Veja todas as ofertas de hoje" text={`Crie sua conta grátis e desbloqueie o preço de mais ${featured.length - FREE_OFFERS} produtos, o comparativo entre as lojas e os favoritos.`} />
                </div>
              )}
            </>
          ) : (
            <p className="ph-empty">Os preços estão sendo atualizados. <Link to="/buscar">Pesquise o catálogo completo</Link>.</p>
          )}
        </section>

        <section className="ph-band" aria-labelledby="ph-basket-title">
          <div className="ph-wrap ph-band__grid">
            <div>
              <h2 id="ph-basket-title">Sua lista inteira, no mercado mais barato.</h2>
              <p>Monte a lista de compras e a Cesta Inteligente calcula em qual loja o total sai menor — ou como dividir entre duas para economizar mais.</p>
              <div className="ph-band__actions">
                <Link className="ph-btn ph-btn--light" to="/cesta-inteligente"><Sparkles aria-hidden="true" /> Usar a Cesta Inteligente</Link>
                <Link className="ph-btn ph-btn--ghost" to="/cesta"><ListChecks aria-hidden="true" /> Montar minha lista</Link>
              </div>
              {guest && <p className="ph-band__hint"><Lock aria-hidden="true" /> Recurso exclusivo para quem tem conta. <Link to={SIGNUP_HREF}>Criar conta grátis</Link></p>}
            </div>
            <ol className="ph-steps">
              <li><strong>Busque</strong><span>Digite o produto ou escolha uma categoria.</span></li>
              <li><strong>Compare</strong><span>Veja o preço em cada loja e quando foi atualizado.</span></li>
              <li><strong>Economize</strong><span>Vá direto à loja certa, ou salve nos favoritos.</span></li>
            </ol>
          </div>
        </section>

        {stores.length > 0 && (
          <section className="ph-section ph-wrap" aria-labelledby="ph-stores-title">
            <header className="ph-section__head">
              <div>
                <h2 id="ph-stores-title">Lojas de Feijó no PreçoCerto</h2>
                <p>{integer.format(storeCount)} estabelecimentos com preços publicados.</p>
              </div>
              <Link to="/estabelecimentos">Ver todas <ArrowRight aria-hidden="true" /></Link>
            </header>
            <ul className="ph-stores">
              {stores.slice(0, guest ? FREE_STORES : stores.length).map(store => (
                <li key={store.id}>
                  <Link className="ph-store" to={`/estabelecimento/${store.slug}`}>
                    <StoreMark store={store} />
                    <span><strong>{store.name}</strong><small>{store.neighborhood || "Feijó"} · {integer.format(store.products)} produtos</small></span>
                  </Link>
                </li>
              ))}
            </ul>
            {guest && stores.length > FREE_STORES && (
              <div className="ph-lock">
                <ul className="ph-stores ph-lock__content" inert aria-hidden="true">
                  {stores.slice(FREE_STORES).map(store => (
                    <li key={store.id}>
                      <span className="ph-store"><StoreMark store={store} /><span><strong>Loja de Feijó</strong><small>Feijó · 000 produtos</small></span></span>
                    </li>
                  ))}
                </ul>
                <LockVeil title="Conheça todas as lojas" text="Crie sua conta grátis para ver todas as lojas, o catálogo completo de cada uma e comparar os preços entre elas." />
              </div>
            )}
          </section>
        )}

        <section className="ph-section ph-wrap" aria-labelledby="ph-merchant-title">
          <div className="ph-merchant">
            <span className="ph-merchant__icon" aria-hidden="true"><BadgeCheck /></span>
            <div>
              <h2 id="ph-merchant-title">Tem um comércio em Feijó?</h2>
              <p>Publique seus preços e ofertas e seja encontrado por quem já está decidindo onde comprar.</p>
            </div>
            <Link className="ph-btn ph-btn--primary" to="/cadastro-lojista">Cadastrar minha loja <ArrowRight aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <Footer />
      <AppDock current="home" />
    </div>
  );
}
