import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, Copy, Link2, ListChecks, LoaderCircle, MessageCircle, Minus, Pencil, Plus, RefreshCw, Scale, Search,
  Sparkles, Store, Trash2, Wallet, X,
} from "lucide-react";
import { fetchCatalog } from "../data/remoteCatalog";
import type { Product, StoreRow } from "../data/catalog";
import { buildAutoBasket } from "../data/autoBasket";
import { formatCategoryLabel } from "../lib/categoryLabels";
import { AppDock, PublicFooter, PublicHeader } from "./PublicChrome";
import { ProductThumb as CatalogProductThumb } from "../components/catalog/ProductThumb";
import { SubscriberGate } from "../components/access/SubscriberGate";
import { useShoppingListItems, type ResolvedItem } from "../features/shoppingLists/useShoppingListItems";
import { renameShoppingList, deleteShoppingList, type ShoppingListMode } from "../features/shoppingLists/useShoppingLists";
import "./ShoppingLists.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODE_LABEL: Record<ShoppingListMode, string> = {
  search: "Busca em lojas distintas",
  store: "Por estabelecimento",
  price: "Por valor/orçamento",
};

function ProductPicker({ products, onPick }: { products: Product[]; onPick: (id: string | number) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  return <div className="pc-lists-picker">
    <div className="pc-lists-picker__input">
      <Search aria-hidden="true" />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto para adicionar…" />
      {query && <button type="button" onClick={() => setQuery("")}><X aria-hidden="true" /></button>}
    </div>
    {results.length > 0 && <ul className="pc-lists-picker__results">
      {results.map(product => <li key={product.id}>
        <button type="button" onClick={() => { onPick(product.id); setQuery(""); }}>
          <CatalogProductThumb product={product} size="sm" />
          <span><strong>{product.name}</strong><small>{[product.brand, product.size].filter(Boolean).join(" · ") || formatCategoryLabel(product.category)}</small></span>
          <em>{brl.format(product.minPrice)}</em>
        </button>
      </li>)}
    </ul>}
  </div>;
}

/**
 * Montagem automática por regras (sem IA generativa, sem custo de API):
 * escolhe os itens essenciais por prioridade no menor preço disponível até
 * bater o orçamento. Fica atrás do mesmo paywall da Cesta Inteligente
 * porque o valor está em economizar tempo montando a lista, não no texto
 * gerado — não precisa de um modelo de linguagem para isso.
 */
function AutoBuildPanel({ budget, people, catalog, targetEstablishmentId, onApplied }: {
  budget: number; people: number; catalog: Product[]; targetEstablishmentId?: string | null;
  onApplied: (items: { productId: string; quantity: number }[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ items: { productId: string; quantity: number }[]; missing: string[]; total: number } | null>(null);

  function runAutoBuild() {
    setBusy(true);
    setError("");
    setSuggestion(null);
    const result = buildAutoBasket(catalog, budget, people, targetEstablishmentId);
    setBusy(false);
    if (!result.items.length) {
      setError("Não foi possível montar uma lista com esse orçamento. Tente aumentar o valor.");
      return;
    }
    setSuggestion(result);
  }

  return <div className="pc-lists-ai">
    <p className="pc-lists-ai__intro"><Sparkles aria-hidden="true" /> Escolhe automaticamente os itens essenciais que cabem no seu orçamento, no melhor preço disponível.</p>
    <button type="button" onClick={runAutoBuild} disabled={busy}>
      {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />} {busy ? "Montando lista…" : "Montar lista automaticamente"}
    </button>
    {error && <p className="pc-lists-ai__error">{error}</p>}
    {suggestion && <div className="pc-lists-ai__result">
      <p>{suggestion.items.length} produtos escolhidos, somando {brl.format(suggestion.total)}.{suggestion.missing.length > 0 && ` Não achamos preço para: ${suggestion.missing.join(", ")}.`}</p>
      <button type="button" onClick={() => void onApplied(suggestion.items)}>Aplicar esta lista</button>
    </div>}
  </div>;
}

function buildShareText(name: string, mode: ShoppingListMode, resolved: ResolvedItem[], total: number) {
  const lines = resolved.map(row => {
    const price = row.unavailableAtStore ? "indisponível" : brl.format((row.unitPrice ?? 0) * row.quantity);
    return `• ${row.quantity}x ${row.product.name} — ${price}${row.establishment ? ` (${row.establishment})` : ""}`;
  });
  return [
    `🛒 ${name} — lista do PreçoCerto`,
    MODE_LABEL[mode],
    "",
    ...lines,
    "",
    `Total estimado: ${brl.format(total)}`,
  ].join("\n");
}

export function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    meta, resolved, loading, total, itemCount, storeCount, missingAtStore,
    addItem, setQuantity, removeItem, togglePurchased, toggleShare, setListMode, applyBulk,
  } = useShoppingListItems(id);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [budgetInput, setBudgetInput] = useState("150");
  const [peopleInput, setPeopleInput] = useState("3");
  const [renaming, setRenaming] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCatalog().then(data => { if (active) { setCatalog(data.products); setStores(data.stores); } });
    return () => { active = false; };
  }, []);

  const mode = meta?.mode ?? "search";
  const targetStore = stores.find(s => String(s.id) === meta?.targetEstablishmentId);
  const displayName = nameOverride ?? meta?.name ?? "";

  async function handleRename(nextName: string) {
    if (!id || !nextName.trim() || nextName.trim() === displayName) { setRenaming(false); return; }
    setNameOverride(nextName.trim());
    setRenaming(false);
    await renameShoppingList(id, nextName.trim());
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm(`Excluir a lista "${displayName}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await deleteShoppingList(id);
    navigate("/minhas-listas");
  }

  /**
   * Leva os itens desta lista para a Cesta Inteligente (/cesta-inteligente),
   * que compara onde a cesta fica mais barata entre os estabelecimentos
   * cadastrados. Passa os itens via sessionStorage (mesma técnica usada pelo
   * prefill de orçamento/pessoas da própria SmartBasketPage) em vez de duplicar
   * a query do catálogo — a página de destino já busca o catálogo sozinha e
   * casa os productId aqui enviados com os produtos carregados lá.
   */
  function compareAcrossStores() {
    try {
      const items = resolved.map(row => ({ productId: String(row.product.id), quantity: row.quantity }));
      sessionStorage.setItem("precocerto:smart-basket-from-list", JSON.stringify({ listId: id, items }));
    } catch { /* sessionStorage indisponível — a Cesta Inteligente abre vazia */ }
    navigate("/cesta-inteligente");
  }

  async function copyShareText() {
    if (!id) return;
    const text = buildShareText(displayName, mode, resolved, total);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível — o texto continua visível pra copiar manualmente */ }
  }

  const shareText = id ? buildShareText(displayName, mode, resolved, total) : "";
  const whatsappShareLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const shareLinkUrl = meta?.shareToken ? `${window.location.origin}/lista-compartilhada/${meta.shareToken}` : "";

  async function handleToggleShare(enabled: boolean, rotate = false) {
    setShareBusy(true);
    await toggleShare(enabled, rotate);
    setShareBusy(false);
  }

  async function copyShareLink() {
    if (!shareLinkUrl) return;
    try {
      await navigator.clipboard.writeText(shareLinkUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard indisponível — o link continua visível pra copiar manualmente */ }
  }

  if (loading) return <main className="pc-lists-state"><LoaderCircle className="spin" aria-hidden="true" /><strong>Carregando sua lista…</strong></main>;
  if (!meta) return <main className="pc-lists-state"><strong>Lista não encontrada.</strong><Link to="/minhas-listas">Voltar para minhas listas</Link></main>;

  return <div className="ref-page pc-lists-page">
    <PublicHeader current="basket" />
    <main id="conteudo-principal" className="pc-lists-shell">
      <Link to="/minhas-listas" className="pc-lists-back"><ArrowLeft aria-hidden="true" /> Minhas listas</Link>

      <section className="pc-lists-hero pc-lists-hero--detail">
        <div>
          <span><ListChecks aria-hidden="true" /> {MODE_LABEL[mode]}</span>
          {renaming
            ? <input
                className="pc-lists-title-rename"
                defaultValue={displayName}
                autoFocus
                onBlur={e => void handleRename(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }}
              />
            : <h1>{displayName}</h1>}
          <div className="pc-lists-header-actions">
            <button type="button" onClick={() => setRenaming(true)}><Pencil aria-hidden="true" /> Renomear</button>
            <button type="button" onClick={() => setShareOpen(v => !v)}><MessageCircle aria-hidden="true" /> Compartilhar</button>
            <button type="button" className="pc-lists-compare-btn" onClick={compareAcrossStores} disabled={!resolved.length}>
              <Scale aria-hidden="true" /> Comparar cesta entre lojas
            </button>
            <button type="button" className="is-danger" onClick={() => void handleDelete()} disabled={deleting}><Trash2 aria-hidden="true" /> {deleting ? "Excluindo…" : "Excluir lista"}</button>
          </div>
          {shareOpen && <div className="pc-lists-share">
            <div className="pc-lists-share__row">
              <a href={whatsappShareLink} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> Enviar pelo WhatsApp</a>
              <button type="button" onClick={() => void copyShareText()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiado!" : "Copiar texto da lista"}</button>
            </div>
            <div className="pc-lists-share__link">
              <p><Link2 aria-hidden="true" /> Link para acompanhar a compra: quem tiver o link marca os itens como comprados conforme vai levando, sem precisar de conta.</p>
              {meta?.shareEnabled ? <>
                <div className="pc-lists-share__link-row">
                  <input readOnly value={shareLinkUrl} onFocus={e => e.target.select()} />
                  <button type="button" onClick={() => void copyShareLink()}>{linkCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {linkCopied ? "Copiado!" : "Copiar"}</button>
                </div>
                <div className="pc-lists-share__link-actions">
                  <button type="button" onClick={() => void handleToggleShare(true, true)} disabled={shareBusy}><RefreshCw aria-hidden="true" /> Gerar novo link (invalida o antigo)</button>
                  <button type="button" className="is-danger" onClick={() => void handleToggleShare(false)} disabled={shareBusy}>Desativar link</button>
                </div>
              </> : <button type="button" className="pc-lists-share__enable" onClick={() => void handleToggleShare(true)} disabled={shareBusy}>
                {shareBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />} Ativar link de acompanhamento
              </button>}
            </div>
          </div>}
        </div>
        <div className="pc-lists-kpis">
          <article><small>ITENS</small><strong>{itemCount}</strong></article>
          <article><small>TOTAL ESTIMADO</small><strong>{brl.format(total)}</strong></article>
          <article><small>ESTABELECIMENTOS</small><strong>{storeCount || "—"}</strong></article>
        </div>
      </section>

      <div className="pc-lists-mode-switch" role="group" aria-label="Modo de montagem">
        <button type="button" className={mode === "search" ? "is-active" : undefined} onClick={() => void setListMode("search")}>
          <ListChecks aria-hidden="true" /> Busca em lojas distintas
        </button>
        <button type="button" className={mode === "price" ? "is-active" : undefined} onClick={() => void setListMode("price")}>
          <Wallet aria-hidden="true" /> Por valor/orçamento
        </button>
        <button type="button" className={mode === "store" ? "is-active" : undefined} onClick={() => void setListMode("store", meta.targetEstablishmentId)}>
          <Store aria-hidden="true" /> Por estabelecimento
        </button>
      </div>

      {mode === "store" && <div className="pc-lists-store-picker">
        <label htmlFor="pc-lists-store-select">Comparar tudo nesta loja:</label>
        <select id="pc-lists-store-select" value={meta.targetEstablishmentId ?? ""} onChange={e => void setListMode("store", e.target.value || null)}>
          <option value="">Escolher estabelecimento…</option>
          {stores.map(store => <option key={store.id} value={String(store.id)}>{store.name}</option>)}
        </select>
        {missingAtStore > 0 && <small className="pc-lists-store-warning">{missingAtStore} {missingAtStore === 1 ? "item não está disponível" : "itens não estão disponíveis"} nesta loja.</small>}
      </div>}

      <ProductPicker products={catalog} onPick={id => void addItem(id)} />

      <section className="pc-lists-ai-toggle">
        <button type="button" onClick={() => setShowAi(v => !v)}><Sparkles aria-hidden="true" /> {showAi ? "Fechar montagem automática" : "Montar (ou completar) esta lista automaticamente"}</button>
      </section>

      {showAi && <section className="pc-lists-ai-wrap">
        <SubscriberGate tool="A montagem automática de listas" plan="cesta_inteligente">
          <div className="pc-lists-ai-inputs">
            <label>Orçamento <input type="number" min={1} value={budgetInput} onChange={e => setBudgetInput(e.target.value)} /></label>
            <label>Pessoas na casa <input type="number" min={1} value={peopleInput} onChange={e => setPeopleInput(e.target.value)} /></label>
          </div>
          <AutoBuildPanel
            budget={Number(budgetInput) || 0}
            people={Number(peopleInput) || 1}
            catalog={catalog}
            targetEstablishmentId={mode === "store" ? meta.targetEstablishmentId : null}
            onApplied={async items => { await applyBulk(items); setShowAi(false); }}
          />
        </SubscriberGate>
      </section>}

      {!resolved.length ? <section className="pc-lists-empty">
        <div className="pc-lists-empty__icon"><ListChecks aria-hidden="true" /></div>
        <h2>Essa lista ainda está vazia.</h2>
        <p>Busque produtos acima ou use a montagem automática para preencher pelo seu orçamento.</p>
      </section> : <section className="pc-lists-items">
        {resolved.map(row => <article key={String(row.product.id)} className={["pc-lists-item", row.unavailableAtStore && "is-unavailable", row.purchased && "is-purchased"].filter(Boolean).join(" ")}>
          <label className="pc-lists-item__check" aria-label={row.purchased ? `Desmarcar ${row.product.name} como comprado` : `Marcar ${row.product.name} como comprado`}>
            <input type="checkbox" checked={row.purchased} onChange={e => void togglePurchased(row.product.id, e.target.checked)} />
          </label>
          <div className="pc-lists-item__product"><span className="pc-lists-thumb"><CatalogProductThumb product={row.product} size="sm" /></span>
            <span><small>{formatCategoryLabel(row.product.category)}</small><strong>{row.product.name}</strong><em>{[row.product.brand, row.product.size].filter(Boolean).join(" · ")}</em></span>
          </div>
          <div className="pc-lists-item__qty">
            <button type="button" onClick={() => void setQuantity(row.product.id, row.quantity - 1)} aria-label={`Diminuir ${row.product.name}`}>{row.quantity === 1 ? <Trash2 aria-hidden="true" /> : <Minus aria-hidden="true" />}</button>
            <strong>{row.quantity}</strong>
            <button type="button" onClick={() => void setQuantity(row.product.id, row.quantity + 1)} aria-label={`Aumentar ${row.product.name}`}><Plus aria-hidden="true" /></button>
          </div>
          <div className="pc-lists-item__price">
            {row.unavailableAtStore ? <small>Não disponível em {targetStore?.name || "loja escolhida"}</small> : <><strong>{brl.format(row.unitPrice ?? 0)}</strong><small>{row.establishment || "Comércio local"}</small></>}
          </div>
          <div className="pc-lists-item__total"><strong>{row.unavailableAtStore ? "—" : brl.format((row.unitPrice ?? 0) * row.quantity)}</strong></div>
          <button className="pc-lists-item__remove" type="button" onClick={() => void removeItem(row.product.id)} aria-label={`Remover ${row.product.name}`}><Trash2 aria-hidden="true" /></button>
        </article>)}
      </section>}
    </main>
    <AppDock current="basket" />
    <PublicFooter />
  </div>;
}
