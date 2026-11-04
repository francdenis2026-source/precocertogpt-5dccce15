import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ListChecks, LoaderCircle, ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fetchCatalog } from "../data/remoteCatalog";
import type { Product } from "../data/catalog";
import { PublicFooter, PublicHeader } from "./PublicChrome";
import { ProductThumb as CatalogProductThumb } from "../components/catalog/ProductThumb";
import type { ShoppingListMode } from "../features/shoppingLists/useShoppingLists";
import "./ShoppingLists.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODE_LABEL: Record<ShoppingListMode, string> = {
  search: "Busca em lojas distintas",
  store: "Por estabelecimento",
  price: "Por valor/orçamento",
};

type SharedItem = { productId: string; quantity: number; purchased: boolean };

export function SharedShoppingListPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ShoppingListMode>("search");
  const [items, setItems] = useState<SharedItem[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !token) { setLoading(false); return; }
      const [{ data }, catalogData] = await Promise.all([
        supabase.rpc("get_shared_shopping_list", { _token: token }),
        fetchCatalog(),
      ]);
      if (!active) return;
      const result = data as { ok?: boolean; error?: string; name?: string; mode?: ShoppingListMode; items?: SharedItem[] } | null;
      if (!result?.ok) {
        setError(result?.error || "Não foi possível abrir essa lista.");
        setLoading(false);
        return;
      }
      setName(result.name || "Lista de compras");
      setMode(result.mode || "search");
      setItems(result.items || []);
      setCatalog(catalogData.products);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [token]);

  async function togglePurchased(productId: string, purchased: boolean) {
    if (!supabase || !token) return;
    setItems(current => current.map(item => item.productId === productId ? { ...item, purchased } : item));
    const { data } = await supabase.rpc("set_shared_shopping_list_item_purchased", { _token: token, _product_id: productId, _purchased: purchased });
    const result = data as { ok?: boolean } | null;
    if (!result?.ok) {
      setItems(current => current.map(item => item.productId === productId ? { ...item, purchased: !purchased } : item));
    }
  }

  const resolved = items
    .map(item => ({ item, product: catalog.find(p => String(p.id) === item.productId) }))
    .filter((row): row is { item: SharedItem; product: Product } => Boolean(row.product));

  const total = resolved.reduce((sum, row) => sum + row.product.minPrice * row.item.quantity, 0);
  const purchasedCount = items.filter(i => i.purchased).length;

  if (loading) return <main className="pc-lists-state"><LoaderCircle className="spin" aria-hidden="true" /><strong>Abrindo lista compartilhada…</strong></main>;
  if (error) return <main className="pc-lists-state"><ShieldAlert aria-hidden="true" /><strong>{error}</strong></main>;

  return <div className="ref-page pc-lists-page">
    <PublicHeader backOnly title="Lista compartilhada" />
    <main id="conteudo-principal" className="pc-lists-shell">
      <section className="pc-lists-hero pc-lists-hero--detail">
        <div>
          <span><ListChecks aria-hidden="true" /> {MODE_LABEL[mode]} · compartilhada</span>
          <h1>{name}</h1>
        </div>
        <div className="pc-lists-kpis">
          <article><small>MARCADOS</small><strong>{purchasedCount}/{items.length}</strong></article>
          <article><small>TOTAL ESTIMADO</small><strong>{brl.format(total)}</strong></article>
        </div>
      </section>

      <p className="pc-lists-shared-hint"><CheckCircle2 aria-hidden="true" /> Marque os itens conforme for colocando no carrinho — não precisa de conta, e quem tem esse link vê a atualização em tempo real.</p>

      {!resolved.length ? <section className="pc-lists-empty">
        <div className="pc-lists-empty__icon"><ListChecks aria-hidden="true" /></div>
        <h2>Essa lista está vazia.</h2>
      </section> : <section className="pc-lists-items">
        {resolved.map(({ item, product }) => <article key={item.productId} className={item.purchased ? "pc-lists-item is-purchased" : "pc-lists-item"}>
          <label className="pc-lists-item__check" aria-label={item.purchased ? `Desmarcar ${product.name}` : `Marcar ${product.name} como comprado`}>
            <input type="checkbox" checked={item.purchased} onChange={e => void togglePurchased(item.productId, e.target.checked)} />
          </label>
          <div className="pc-lists-item__product"><span className="pc-lists-thumb"><CatalogProductThumb product={product} size="sm" /></span>
            <span><small>{product.category}</small><strong>{product.name}</strong><em>{[product.brand, product.size].filter(Boolean).join(" · ")}</em></span>
          </div>
          <div className="pc-lists-item__qty"><strong>{item.quantity}x</strong></div>
          <div className="pc-lists-item__price"><strong>{brl.format(product.minPrice)}</strong><small>{product.establishment || "Comércio local"}</small></div>
          <div className="pc-lists-item__total"><strong>{brl.format(product.minPrice * item.quantity)}</strong></div>
        </article>)}
      </section>}
    </main>
    <PublicFooter />
  </div>;
}
