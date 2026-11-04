import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP, gsap, ScrollTrigger } from "../lib/lightMotion";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Minus, PiggyBank, Plus, ShoppingBasket, Sparkles, Store, Trash2 } from "lucide-react";
import { fetchCatalog } from "../data/remoteCatalog";
import { formatCategoryLabel } from "../lib/categoryLabels";
import type { Product } from "../data/catalog";
import { AppDock, PublicFooter, PublicHeader } from "./PublicChrome";
import { ProductThumb as CatalogProductThumb } from "../components/catalog/ProductThumb";
import "./ProfessionalBasketPage.css";
import "./CompactViewportPages.css";

gsap.registerPlugin(ScrollTrigger);

type BasketEntry = { productId: string; quantity: number };
const BASKET_KEY = "precocerto:active_basket_items";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function readBasket(): BasketEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BASKET_KEY) || "[]") as Array<Partial<BasketEntry> & { id?: string | number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => ({ productId: String(item.productId ?? item.id ?? ""), quantity: Math.max(1, Number(item.quantity || 1)) })).filter(item => item.productId);
  } catch { return []; }
}

function writeBasket(items: BasketEntry[]) {
  localStorage.setItem(BASKET_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("pc:basket-changed"));
}

export function ProfessionalBasketPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<BasketEntry[]>(readBasket);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCatalog().then(catalog => { if (active) setProducts(catalog.products); }).finally(() => { if (active) setLoading(false); });
    const refresh = () => setEntries(readBasket());
    window.addEventListener("pc:basket-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => { active = false; window.removeEventListener("pc:basket-changed", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  const rows = useMemo(() => entries.map(entry => ({ entry, product: products.find(product => String(product.id) === entry.productId) })).filter((row): row is { entry: BasketEntry; product: Product } => Boolean(row.product)), [entries, products]);
  const itemCount = entries.reduce((sum, item) => sum + item.quantity, 0);
  const bestTotal = rows.reduce((sum, row) => sum + row.product.minPrice * row.entry.quantity, 0);
  const maxTotal = rows.reduce((sum, row) => sum + row.product.maxPrice * row.entry.quantity, 0);
  const savings = Math.max(0, maxTotal - bestTotal);
  const storeCount = new Set(rows.map(row => row.product.establishment).filter(Boolean)).size;

  function update(productId: string | number, delta: number) {
    const id = String(productId);
    const current = readBasket();
    const found = current.find(item => item.productId === id);
    const next = found
      ? current.map(item => item.productId === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0)
      : delta > 0 ? [...current, { productId: id, quantity: delta }] : current;
    writeBasket(next);
    setEntries(next);
  }

  function remove(productId: string | number) {
    const next = readBasket().filter(item => item.productId !== String(productId));
    writeBasket(next);
    setEntries(next);
  }

  // Entrada suave da hero (eyebrow, título, texto, KPIs em cascata) e,
  // assim que a lista real substitui o esqueleto de carregamento, um
  // stagger nos itens da lista e no resumo lateral — ambos ficam acima da
  // dobra na maioria das telas, então revelar ao montar (sem scroll
  // trigger) é mais apropriado do que esperar rolagem. Respeita
  // prefers-reduced-motion e anima só transform/opacity.
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(".pro-basket-eyebrow, .pro-basket-hero h1, .pro-basket-hero > div:first-child > p", { y: 16, opacity: 0, duration: .55, stagger: .06, ease: "power3.out" });
    gsap.from(".pro-basket-kpis article", { y: 14, opacity: 0, duration: .5, stagger: .06, delay: .1, ease: "power2.out" });
    if (!loading && rows.length) {
      gsap.from(".pro-basket-item", { y: 14, opacity: 0, duration: .5, stagger: .05, ease: "power2.out" });
      gsap.from(".pro-basket-summary", { y: 16, opacity: 0, duration: .55, delay: .1, ease: "power2.out" });
    }
  }, { scope: pageRef, dependencies: [loading] });

  return <><div className="pro-basket-page" ref={pageRef}>
    <PublicHeader current="basket"/>

    <main id="conteudo-principal" className="pro-basket-shell">
      <section className="pro-basket-hero">
        <div><span className="pro-basket-eyebrow"><ShoppingBasket /> SUA LISTA DE COMPRAS</span><h1>Uma visão clara do que comprar e quanto pode economizar.</h1><p>Organize quantidades, acompanhe o melhor total estimado e use a comparação local para decidir onde vale mais a pena comprar.</p></div>
        <div className="pro-basket-kpis">
          <article><small>ITENS</small><strong>{itemCount}</strong><span>{rows.length} produtos diferentes</span></article>
          <article><small>MELHOR TOTAL</small><strong>{brl.format(bestTotal)}</strong><span>somando os menores preços</span></article>
          <article className="is-saving"><small>ECONOMIA POSSÍVEL</small><strong>{brl.format(savings)}</strong><span>comparando antes de comprar</span></article>
        </div>
      </section>

      {loading ? <section className="pro-basket-loading"><span /><strong>Organizando sua lista…</strong></section> : !rows.length ? <section className="pro-basket-empty"><div className="pro-basket-empty__icon"><ShoppingBasket /></div><small>LISTA VAZIA</small><h2>Comece pelos produtos que você realmente precisa.</h2><p>Adicione itens do catálogo e o PreçoCerto organiza preços e economia para você.</p><div><Link to="/buscar">Adicionar produtos <ArrowRight /></Link><Link to="/cesta-inteligente"><Sparkles /> Montar cesta por orçamento</Link></div></section> : <section className="pro-basket-workspace">
        <div className="pro-basket-list">
          <header><div><small>PRODUTOS SELECIONADOS</small><h2>Sua lista</h2></div><Link to="/buscar">+ Adicionar produto</Link></header>
          <div className="pro-basket-table-head"><span>Produto</span><span>Quantidade</span><span>Melhor preço</span><span>Total</span><span /></div>
          {rows.map(({ entry, product }) => <article key={product.id} className="pro-basket-item">
            <div className="pro-basket-product"><span className="pro-basket-thumb"><CatalogProductThumb product={product} size="sm" /></span><span><small>{formatCategoryLabel(product.category)}</small><strong>{product.name}</strong><em>{[product.brand, product.size].filter(Boolean).join(" · ")}</em></span></div>
            <div className="pro-basket-qty"><button type="button" onClick={() => update(product.id, -1)} aria-label={`Diminuir ${product.name}`}>{entry.quantity === 1 ? <Trash2 /> : <Minus />}</button><strong>{entry.quantity}</strong><button type="button" onClick={() => update(product.id, 1)} aria-label={`Aumentar ${product.name}`}><Plus /></button></div>
            <div className="pro-basket-unit"><strong>{brl.format(product.minPrice)}</strong><small>{product.establishment || "Comércio local"}</small></div>
            <div className="pro-basket-line-total"><strong>{brl.format(product.minPrice * entry.quantity)}</strong><small>{product.maxPrice > product.minPrice ? `até ${brl.format((product.maxPrice - product.minPrice) * entry.quantity)} de diferença` : "melhor preço atual"}</small></div>
            <button className="pro-basket-remove" type="button" onClick={() => remove(product.id)} aria-label={`Remover ${product.name}`}><Trash2 /></button>
          </article>)}
        </div>

        <aside className="pro-basket-summary">
          <header><span><PiggyBank /></span><div><small>RESUMO DA LISTA</small><h2>Planejamento</h2></div></header>
          <dl><div><dt>Produtos</dt><dd>{rows.length}</dd></div><div><dt>Unidades</dt><dd>{itemCount}</dd></div><div><dt>Estabelecimentos de referência</dt><dd>{storeCount || "—"}</dd></div><div><dt>Sem comparar</dt><dd>{brl.format(maxTotal)}</dd></div></dl>
          <div className="pro-basket-total"><span>Melhor total estimado</span><strong>{brl.format(bestTotal)}</strong><small><BadgeCheck /> preços do catálogo local</small></div>
          <div className="pro-basket-saving"><span>Você pode economizar</span><strong>{brl.format(savings)}</strong></div>
          <Link className="pro-basket-primary" to="/cesta-inteligente"><Sparkles /> Otimizar com Cesta Inteligente <ArrowRight /></Link>
          <Link className="pro-basket-secondary" to="/minhas-listas"><ShoppingBasket /> Salvar como lista, criar outras</Link>
          <Link className="pro-basket-secondary" to="/estabelecimentos"><Store /> Ver estabelecimentos</Link>
          <p>Os valores são estimativas com base nos preços cadastrados. Confirme disponibilidade e preço antes da compra.</p>
        </aside>
      </section>}
    </main>
    <AppDock current="basket"/>
  </div>
  <PublicFooter/></>;
}
