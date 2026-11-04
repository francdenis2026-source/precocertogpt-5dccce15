/* The catalog-derived filter guards intentionally reconcile dependent controls after data changes. */
/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP, gsap, ScrollTrigger } from "../lib/lightMotion";
import { ArrowRight, BadgeCheck, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink, Heart, LockKeyhole, MapPin, PackageSearch, RotateCcw, Search, ShoppingBasket, ShoppingCart, Sparkles, SlidersHorizontal, Store, TrendingDown, UserPlus, X } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { CatalogPayload, Product, StoreRow } from "../data/catalog";
import { fetchSectorCatalog, productHasSectorOffer, sectorStores } from "../data/sectorCatalog";
import { getMarketplaceSector, marketplaceSectors, type MarketplaceSectorId } from "./MarketplaceSectors";
import { resolveProductImage } from "../data/productImageResolver";
import { AppDock, PublicFooter, PublicHeader } from "./PublicChrome";
import { productSearchScore } from "../lib/productSearch";
import { useFavorites } from "../features/favorites/FavoritesProvider";
import { usePriceVisibility } from "../hooks/usePriceVisibility";
import { addToBasketWithAuthGuard } from "../lib/basket";
import { useProductOnlineSales } from "../lib/onlineSalesAvailability";
import { ProductThumb as CatalogProductThumb } from "../components/catalog/ProductThumb";
import { ProductCardActions } from "../components/catalog/ProductCardActions";
import { trackSearch } from "../lib/analytics";
import { formatCategoryLabel } from "../lib/categoryLabels";
import "./SearchDiscovery2026.css";
import "./CompactViewportPages.css";

gsap.registerPlugin(ScrollTrigger);

const FREE_PREVIEW_LIMIT=4;
const PAGE_SIZE=20;
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const intBr=new Intl.NumberFormat("pt-BR");
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
type SortMode="relevance"|"lowest"|"highest"|"name"|"stores";
function ProductComparisonModal({product,onClose}:{product:Product;onClose:()=>void}){
 const closeRef=useRef<HTMLButtonElement>(null);
 const dialogRef=useRef<HTMLElement>(null);
 const image=resolveProductImage(product);
 const offers=(product.offers?.length?product.offers:[{establishmentId:product.establishmentId,establishmentSlug:product.establishmentSlug,establishment:product.establishment,neighborhood:product.neighborhood,storeColor:product.storeColor,value:product.minPrice,capturedAt:product.capturedAt}]).slice().sort((a,b)=>a.value-b.value);
 const lowest=offers[0]?.value??product.minPrice;
 const highest=offers.at(-1)?.value??product.maxPrice;
 const saving=Math.max(0,highest-lowest);
 const {isFavorite,toggleFavorite}=useFavorites();
 const favorite=isFavorite(product.id);
 const [basketMessage,setBasketMessage]=useState("");
 const {canBuyOnline,merchantId}=useProductOnlineSales(product.id,offers[0]?.establishmentId??product.establishmentId,offers[0]?.establishmentSlug??product.establishmentSlug);
 const handleAddToBasket=async()=>{
  const result=await addToBasketWithAuthGuard(product.id);
  if(result==="auth-required")return;
  setBasketMessage(result==="exists"?"Já está na sua cesta.":"Adicionado à cesta.");
  window.setTimeout(()=>setBasketMessage(""),2200);
 };
 useEffect(()=>{
  /* Trava robusta: só "overflow:hidden" no body não segura o rubber-band
     do Safari/iOS — ao arrastar a lista de lojas dentro do modal, a página
     de fundo "vazava" por baixo do dock inferior fixo. Fixar o body na
     posição atual (position:fixed + top negativo) e devolver o scroll ao
     fechar elimina esse vazamento nas duas plataformas. */
  const scrollY=window.scrollY;
  const body=document.body;
  const previous={position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:body.style.overflow};
  body.style.position="fixed";
  body.style.top=`-${scrollY}px`;
  body.style.left="0";
  body.style.right="0";
  body.style.width="100%";
  body.style.overflow="hidden";
  closeRef.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){onClose();return}
   if(event.key!=="Tab"||!dialogRef.current)return;
   const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
   if(!focusable.length)return;
   const first=focusable[0],last=focusable.at(-1)!;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  window.addEventListener("keydown",onKeyDown);
  return()=>{
   body.style.position=previous.position;
   body.style.top=previous.top;
   body.style.left=previous.left;
   body.style.right=previous.right;
   body.style.width=previous.width;
   body.style.overflow=previous.overflow;
   window.scrollTo(0,scrollY);
   window.removeEventListener("keydown",onKeyDown);
  };
 },[onClose]);
 const meaningful=(value?:string)=>{const v=(value||"").trim();return v&&v!=="-"?v:undefined};
 const eyebrow=[meaningful(formatCategoryLabel(product.category)),meaningful(product.brand)].filter(Boolean).join(" · ");
 const descriptor=[meaningful(product.size)||meaningful(product.unit),`${offers.length} ${offers.length===1?"estabelecimento":"estabelecimentos"}`].filter(Boolean).join(" · ");
 return <div className="search26-modal" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialogRef} className="search26-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="search26-modal-title" aria-describedby="search26-modal-description">
   <span className="search26-modal__grip" aria-hidden="true"/>
   <div className="search26-modal__hero">
    <div className="search26-modal__hero-top">
     {eyebrow?<span className="search26-modal__eyebrow">{eyebrow}</span>:<span/>}
     <button ref={closeRef} type="button" className="search26-modal__close" onClick={onClose} aria-label="Fechar detalhes do produto"><X aria-hidden="true"/></button>
    </div>
    <div className="search26-modal__hero-main">
     <div className="search26-modal__hero-media">{image?<img src={image} alt={product.name}/>:<PackageSearch aria-hidden="true"/>}</div>
     <div className="search26-modal__hero-copy">
      <h2 id="search26-modal-title">{product.name}</h2>
      {descriptor&&<p id="search26-modal-description">{descriptor}</p>}
     </div>
    </div>
    <div className="search26-modal__hero-price">
     <div><small>Melhor preço</small><strong>{brl.format(lowest)}</strong></div>
     {saving>0&&<span><TrendingDown aria-hidden="true"/> Economize até {brl.format(saving)}</span>}
    </div>
   </div>

   <div className="search26-modal__body">
    <div className="search26-modal__actions">
     <button type="button" className={`search26-modal__action${favorite?" is-active":""}`} onClick={()=>void toggleFavorite(product.id)}>
      <Heart aria-hidden="true" fill={favorite?"currentColor":"none"}/> {favorite?"Nos favoritos":"Favoritar"}
     </button>
     <button type="button" className="search26-modal__action" onClick={()=>void handleAddToBasket()}>
      <ShoppingBasket aria-hidden="true"/> Adicionar à cesta
     </button>
    </div>
    {basketMessage&&<p className="search26-modal__toast" role="status">{basketMessage}</p>}
    {canBuyOnline&&merchantId&&<Link className="search26-modal__buy" to={`/loja/${merchantId}`} onClick={onClose}><ShoppingCart aria-hidden="true"/> Comprar online nesta loja</Link>}

    <div className="search26-modal__stores">
     <div className="search26-modal__stores-head"><span><BadgeCheck aria-hidden="true"/> Onde encontrar, do menor para o maior preço</span></div>
     <div className="search26-modal__offer-list">{offers.map((offer,index)=><Link to={`/estabelecimento/${offer.establishmentSlug||offer.establishmentId}`} className={index===0?"is-best":undefined} key={`${offer.establishmentId}-${offer.value}`} onClick={onClose}><i style={{backgroundColor:offer.storeColor||"#14795d"}}><Store aria-hidden="true"/></i><span><strong>{offer.establishment||"Comércio local"}</strong><small><MapPin aria-hidden="true"/>{offer.neighborhood||"Feijó-AC"}</small></span><div><b>{brl.format(offer.value)}</b>{index===0&&<em>Melhor preço</em>}</div><ArrowRight aria-hidden="true"/></Link>)}</div>
     <div className="search26-modal__freshness"><Clock3 aria-hidden="true"/><span>Preços informativos. Confirme a disponibilidade no estabelecimento antes de comprar.</span></div>
    </div>
   </div>

   <footer className="search26-modal__footer"><Link to={`/produto/${product.slug||product.id}`} onClick={onClose}>Ver página completa do produto <ExternalLink aria-hidden="true"/></Link></footer>
  </section>
 </div>
}

const SORT_OPTIONS:{id:SortMode;label:string}[]=[
 {id:"relevance",label:"Mais relevantes"},
 {id:"lowest",label:"Menor preço"},
 {id:"highest",label:"Maior preço"},
 {id:"stores",label:"Mais estabelecimentos"},
 {id:"name",label:"Nome A-Z"},
];

/**
 * Painel "Filtrar busca". Antes era uma seção que se expandia inline, sob o
 * botão de filtro — <select> nativos empilhados, sem hierarquia visual, e
 * só permitia escolher UM estabelecimento por vez. Virou um painel próprio
 * (folha de tela cheia no mobile, diálogo centralizado no desktop, mesma
 * linguagem dos outros modais do site) com dois ganhos reais: os filtros
 * ganharam estrutura em seções tocáveis, e "Estabelecimentos" agora é uma
 * lista de checkboxes com busca embutida — dá pra marcar vários mercados de
 * uma vez (ex.: comparar só entre 3 mercados específicos) em vez de um só.
 * Os filtros continuam aplicando ao vivo (o estado é o mesmo que já
 * alimenta a busca); o painel só junta tudo num lugar organizado e fecha ao
 * confirmar.
 */
function SearchFiltersModal({
 stores,sector,setSector,selectedStores,toggleStore,clearStores,
 category,setCategory,categories,neighborhood,setNeighborhood,neighborhoods,
 minPrice,setMinPrice,maxPrice,setMaxPrice,sort,setSort,
 activeFilters,resultCount,onApply,onClose,onClearAll,
}:{
 stores:StoreRow[];sector:MarketplaceSectorId;setSector:(v:MarketplaceSectorId)=>void;
 selectedStores:string[];toggleStore:(id:string)=>void;clearStores:()=>void;
 category:string;setCategory:(v:string)=>void;categories:string[];
 neighborhood:string;setNeighborhood:(v:string)=>void;neighborhoods:string[];
 minPrice:string;setMinPrice:(v:string)=>void;maxPrice:string;setMaxPrice:(v:string)=>void;
 sort:SortMode;setSort:(v:SortMode)=>void;
 activeFilters:number;resultCount:number;onApply:()=>void;onClose:()=>void;onClearAll:()=>void;
}){
 const dialogRef=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const[storeQuery,setStoreQuery]=useState("");
 const filteredStores=useMemo(()=>{
  const needle=normalize(storeQuery);
  const sorted=[...stores].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  if(!needle)return sorted;
  return sorted.filter(s=>normalize(s.name).includes(needle)||normalize(s.neighborhood||"").includes(needle));
 },[stores,storeQuery]);

 useEffect(()=>{
  const previousOverflow=document.body.style.overflow;
  const scrollY=window.scrollY;
  const body=document.body;
  const previous={position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:previousOverflow};
  body.style.position="fixed";body.style.top=`-${scrollY}px`;body.style.left="0";body.style.right="0";body.style.width="100%";body.style.overflow="hidden";
  closeRef.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){onClose();return}
   if(event.key!=="Tab"||!dialogRef.current)return;
   const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
   if(!focusable.length)return;
   const first=focusable[0],last=focusable.at(-1)!;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",onKeyDown);
  return()=>{
   document.removeEventListener("keydown",onKeyDown);
   body.style.position=previous.position;body.style.top=previous.top;body.style.left=previous.left;body.style.right=previous.right;body.style.width=previous.width;body.style.overflow=previous.overflow;
   window.scrollTo(0,scrollY);
  };
 },[onClose]);

 return <div className="sfm-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialogRef} className="sfm-dialog" role="dialog" aria-modal="true" aria-labelledby="sfm-title">
   <header className="sfm-head">
    <div><h2 id="sfm-title">Filtrar busca</h2><p>{activeFilters>0?`${activeFilters} ${activeFilters===1?"filtro ativo":"filtros ativos"}`:"Refine por loja, tipo, categoria, bairro ou preço"}</p></div>
    <button ref={closeRef} type="button" className="sfm-close" onClick={onClose} aria-label="Fechar filtros"><X aria-hidden="true"/></button>
   </header>

   <div className="sfm-body">
    <div className="sfm-col sfm-col--refine">
     <div className="sfm-section">
      <h3>Ordenar por</h3>
      <div className="sfm-chips">{SORT_OPTIONS.map(opt=><button key={opt.id} type="button" className={sort===opt.id?"is-active":undefined} onClick={()=>setSort(opt.id)} aria-pressed={sort===opt.id}>{opt.label}</button>)}</div>
     </div>

     <div className="sfm-section">
      <h3>Tipo de comércio</h3>
      <div className="sfm-chips">
       <button type="button" className={sector==="all"?"is-active":undefined} onClick={()=>setSector("all" as MarketplaceSectorId)} aria-pressed={sector==="all"}>Todos os tipos</button>
       {marketplaceSectors.map(s=><button key={s.id} type="button" className={sector===s.id?"is-active":undefined} onClick={()=>setSector(s.id)} aria-pressed={sector===s.id}>{s.shortLabel}</button>)}
      </div>
     </div>

     <div className="sfm-section-row">
      <div className="sfm-section">
       <h3>Categoria</h3>
       <div className="sfm-select"><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c=><option key={c} value={c}>{formatCategoryLabel(c)}</option>)}</select><ChevronDown aria-hidden="true"/></div>
      </div>
      <div className="sfm-section">
       <h3>Bairro</h3>
       <div className="sfm-select"><select value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}><option value="all">Todos</option>{neighborhoods.map(n=><option key={n}>{n}</option>)}</select><ChevronDown aria-hidden="true"/></div>
      </div>
     </div>

     <div className="sfm-section">
      <h3>Faixa de preço</h3>
      <div className="sfm-price-row">
       <label>Mínimo<div className="sfm-price-input"><span>R$</span><input inputMode="decimal" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="0,00"/></div></label>
       <label>Máximo<div className="sfm-price-input"><span>R$</span><input inputMode="decimal" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Sem limite"/></div></label>
      </div>
     </div>

     <p className="sfm-note"><Building2 aria-hidden="true"/>Mostramos apenas opções realmente cadastradas no catálogo.</p>
    </div>

    <div className="sfm-col sfm-col--stores">
     <div className="sfm-section sfm-section--stores">
      <div className="sfm-section__head">
       <h3>Estabelecimentos{selectedStores.length>0&&<b className="sfm-count">{selectedStores.length}</b>}</h3>
       {selectedStores.length>0&&<button type="button" className="sfm-linkbtn" onClick={clearStores}>Limpar seleção</button>}
      </div>
      <div className="sfm-store-search"><Search aria-hidden="true"/><input value={storeQuery} onChange={e=>setStoreQuery(e.target.value)} placeholder="Buscar estabelecimento ou bairro…" aria-label="Buscar estabelecimento"/></div>
      <div className="sfm-store-list" role="group" aria-label="Estabelecimentos">
       {filteredStores.length===0&&<p className="sfm-store-empty">Nenhum estabelecimento encontrado.</p>}
       {filteredStores.map(s=>{
        const id=String(s.id);
        const checked=selectedStores.includes(id);
        return <label className={`sfm-store-row${checked?" is-checked":""}`} key={id}>
         <input type="checkbox" checked={checked} onChange={()=>toggleStore(id)}/>
         <span className="sfm-store-row__box"><Check aria-hidden="true"/></span>
         <span className="sfm-store-row__copy"><strong>{s.name}</strong><small>{s.neighborhood||"Feijó · AC"} · {intBr.format(s.products||0)} {s.products===1?"produto":"produtos"}</small></span>
        </label>;
       })}
      </div>
     </div>
    </div>
   </div>

   <footer className="sfm-foot">
    <button type="button" className="sfm-clear" onClick={onClearAll}><RotateCcw aria-hidden="true"/> Limpar tudo</button>
    <button type="button" className="sfm-apply" onClick={onApply}>Ver {intBr.format(resultCount)} {resultCount===1?"resultado":"resultados"}</button>
   </footer>
  </section>
 </div>;
}

export function SearchDiscovery2026(){
 const pageRef=useRef<HTMLDivElement>(null);
 const location=useLocation();
 const{userId}=useFavorites();
 const{allPricesVisible}=usePriceVisibility();
 const isGuest=!userId&&!allPricesVisible;
 const[params,setParams]=useSearchParams();
 const initialQuery=params.get("q")||"";
 const[catalog,setCatalog]=useState<CatalogPayload|null>(null),[loading,setLoading]=useState(true);
 const[query,setQuery]=useState(initialQuery),[appliedQuery,setAppliedQuery]=useState(initialQuery);
 const[sector,setSector]=useState<MarketplaceSectorId>((getMarketplaceSector(params.get("setor"))?.id||"all") as MarketplaceSectorId);
 const[selectedStores,setSelectedStores]=useState<string[]>(()=>{const raw=params.get("lojas")||params.get("loja");return raw&&raw!=="all"?raw.split(",").filter(Boolean):[]}),[category,setCategory]=useState(params.get("categoria")||"all"),[neighborhood,setNeighborhood]=useState(params.get("bairro")||"all");
 const[minPrice,setMinPrice]=useState(params.get("min")||""),[maxPrice,setMaxPrice]=useState(params.get("max")||"");
 const[sort,setSort]=useState<SortMode>((params.get("ordem") as SortMode)||"relevance"),[filtersOpen,setFiltersOpen]=useState(false),[page,setPage]=useState(1),[selectedProduct,setSelectedProduct]=useState<Product|null>(null);
 const lastProductTrigger=useRef<HTMLElement|null>(null);
 useEffect(()=>{let active=true;void fetchSectorCatalog().then(data=>{if(active)setCatalog(data)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>{const next=query.trim();setAppliedQuery(next);setPage(1);setParams(current=>{const updated=new URLSearchParams(current);if(next)updated.set("q",next);else updated.delete("q");return updated},{replace:true})},180);return()=>window.clearTimeout(timer)},[query,setParams]);
 const activeSector=getMarketplaceSector(sector);
 const stores=useMemo(()=>{if(!catalog)return[];if(!activeSector)return[...catalog.stores].filter(s=>(s.products||0)>0).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));return sectorStores(catalog,activeSector).map(item=>item.store)},[catalog,activeSector]);
 const categories=useMemo(()=>{if(!catalog)return[];const source=activeSector?catalog.products.filter(p=>productHasSectorOffer(p,catalog,activeSector)):catalog.products;return Array.from(new Set(source.map(p=>p.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"))},[catalog,activeSector]);
 const neighborhoods=useMemo(()=>Array.from(new Set(stores.map(s=>s.neighborhood).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[stores]);
 const activeFilters=[sector!=="all",selectedStores.length>0,category!=="all",neighborhood!=="all",Boolean(minPrice),Boolean(maxPrice)].filter(Boolean).length;
 const hasRequest=Boolean(appliedQuery.trim())||activeFilters>0;
 const results=useMemo(()=>{if(!catalog||!hasRequest)return[];const min=Number(minPrice.replace(",",".")),max=Number(maxPrice.replace(",","."));const storeIds=selectedStores.length?new Set(selectedStores):null;const rows=catalog.products.map(product=>({product,score:productSearchScore(product,appliedQuery)})).filter(({product,score:rank})=>{if(appliedQuery.trim()&&rank<=0)return false;if(activeSector&&!productHasSectorOffer(product,catalog,activeSector))return false;if(storeIds&&!storeIds.has(String(product.establishmentId))&&!product.offers?.some(o=>storeIds.has(String(o.establishmentId))))return false;if(category!=="all"&&product.category!==category)return false;if(neighborhood!=="all"&&normalize(product.neighborhood)!==normalize(neighborhood)&&!product.offers?.some(o=>normalize(o.neighborhood)===normalize(neighborhood)))return false;if(Number.isFinite(min)&&min>0&&product.minPrice<min)return false;if(Number.isFinite(max)&&max>0&&product.minPrice>max)return false;return true});rows.sort((a,b)=>sort==="lowest"?a.product.minPrice-b.product.minPrice:sort==="highest"?b.product.minPrice-a.product.minPrice:sort==="name"?a.product.name.localeCompare(b.product.name,"pt-BR"):sort==="stores"?(b.product.storeCount||0)-(a.product.storeCount||0):b.score-a.score||a.product.minPrice-b.product.minPrice);return rows.map(r=>r.product)},[catalog,hasRequest,appliedQuery,activeSector,selectedStores,category,neighborhood,minPrice,maxPrice,sort]);
 const featuredProducts=useMemo(()=>catalog?.products.slice().sort((a,b)=>(b.storeCount||0)-(a.storeCount||0)||a.minPrice-b.minPrice).slice(0,4)??[],[catalog]);
 useEffect(()=>setPage(1),[appliedQuery,sector,selectedStores,category,neighborhood,minPrice,maxPrice,sort]);
 // Alimenta "produtos mais buscados": um registro por termo aplicado
 // (já debounced acima), independente de o visitante estar logado ou não.
 useEffect(()=>{if(appliedQuery.trim())trackSearch(appliedQuery)},[appliedQuery]);
 // Quando o tipo de comércio muda, a lista de lojas disponíveis encolhe —
 // remove da seleção qualquer loja marcada que não pertença mais a ela.
 // Só troca a referência do array quando algo realmente saiu, pra não
 // disparar o efeito de novo à toa.
 useEffect(()=>{setSelectedStores(current=>{if(!current.length)return current;const valid=new Set(stores.map(s=>String(s.id)));const filtered=current.filter(id=>valid.has(id));return filtered.length===current.length?current:filtered})},[stores]);
 useEffect(()=>{if(category!=="all"&&!categories.includes(category))setCategory("all")},[categories,category]);
 const toggleStore=(id:string)=>setSelectedStores(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 const clearStores=()=>setSelectedStores([]);
 const syncUrl=(nextQuery=appliedQuery)=>{const next:Record<string,string>={};if(nextQuery.trim())next.q=nextQuery.trim();if(sector!=="all")next.setor=sector;if(selectedStores.length)next.lojas=selectedStores.join(",");if(category!=="all")next.categoria=category;if(neighborhood!=="all")next.bairro=neighborhood;if(minPrice)next.min=minPrice;if(maxPrice)next.max=maxPrice;if(sort!=="relevance")next.ordem=sort;setParams(next,{replace:true})};
 const submit=(e:FormEvent)=>{e.preventDefault();const next=query.trim();setAppliedQuery(next);setPage(1);syncUrl(next)};
 const applyFilters=()=>{setAppliedQuery(query.trim());setPage(1);syncUrl(query.trim());setFiltersOpen(false)};
 const reset=()=>{setQuery("");setAppliedQuery("");setSector("all");setSelectedStores([]);setCategory("all");setNeighborhood("all");setMinPrice("");setMaxPrice("");setSort("relevance");setPage(1);setParams({}, {replace:true})};
 // "Limpar tudo" dentro do painel de filtros: diferente de reset() (usado
 // pelo botão "Nova busca"), preserva o texto pesquisado — a pessoa não
 // esperaria que limpar os filtros também apagasse o que ela digitou.
 const clearAllFilters=()=>{setSector("all");setSelectedStores([]);setCategory("all");setNeighborhood("all");setMinPrice("");setMaxPrice("");setSort("relevance");setPage(1)};
 const openProduct=(product:Product,target:HTMLElement)=>{lastProductTrigger.current=target;setSelectedProduct(product)};
 const openProductOnActivate=(product:Product)=>({
  onClick:(event:MouseEvent<HTMLElement>)=>openProduct(product,event.currentTarget),
  onKeyDown:(event:ReactKeyboardEvent<HTMLElement>)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openProduct(product,event.currentTarget)}},
 });
 const closeProduct=()=>{setSelectedProduct(null);window.setTimeout(()=>lastProductTrigger.current?.focus(),0)};
 useGSAP(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  gsap.from(".search26-hero > *, .search26-search, .search26-filterbar",{y:16,opacity:0,duration:.55,stagger:.06,ease:"power3.out"});
 },{scope:pageRef});
 return <div className="search26-page" ref={pageRef}><PublicHeader current="search" /><main id="conteudo-principal" className="search26-shell search26-main">
  <section className="search26-hero">
   <div className="search26-hero__copy">
    <span><Search aria-hidden="true"/> Busca inteligente local</span>
    <h1>Procure só o que você precisa.</h1>
    <p>Digite um produto, marca ou loja e compare o menor preço em segundos.</p>
   </div>
   <figure className="search26-hero__visual">
    <img src="/sector-heroes/markets-v3.jpg" alt="Corredor de um mercado local com prateleiras de frutas, verduras e grãos" loading="eager" width="1280" height="960"/>
    <figcaption><BadgeCheck aria-hidden="true"/><strong>{intBr.format(catalog?.metrics.products||0)} produtos</strong><small>disponíveis para consulta</small></figcaption>
   </figure>
  </section>
 <form className="search26-search" onSubmit={submit}><Search aria-hidden="true"/><label className="search26-input-label" htmlFor="product-search">Buscar produto, marca ou estabelecimento</label><input id="product-search" name="produto" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: arroz, café, Mercado X…" autoComplete="off" aria-describedby="search26-live-hint"/>{query&&<button className="search26-clear" type="button" onClick={()=>setQuery("")} aria-label="Limpar busca"><X aria-hidden="true"/></button>}<button className="pc-btn pc-btn--primary" disabled={!query.trim()&&activeFilters===0}>Buscar <ArrowRight/></button><span id="search26-live-hint" className="sr-only">Os resultados são atualizados automaticamente enquanto você digita.</span></form>
 <section className="search26-filterbar"><button type="button" className={filtersOpen||activeFilters?"is-active":""} onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal/>Filtrar busca{activeFilters>0&&<b>{activeFilters}</b>}<ChevronDown/></button>{hasRequest&&<div className="search26-quick"><label><select value={sort} onChange={e=>setSort(e.target.value as SortMode)} aria-label="Ordenar resultados"><option value="relevance">Mais relevantes</option><option value="lowest">Menor preço</option><option value="highest">Maior preço</option><option value="stores">Mais estabelecimentos</option><option value="name">Nome A-Z</option></select></label></div>}{hasRequest&&<button type="button" className="search26-reset" onClick={reset}><RotateCcw/>Nova busca</button>}</section>
 {filtersOpen&&<SearchFiltersModal
   stores={stores} sector={sector} setSector={setSector}
   selectedStores={selectedStores} toggleStore={toggleStore} clearStores={clearStores}
   category={category} setCategory={setCategory} categories={categories}
   neighborhood={neighborhood} setNeighborhood={setNeighborhood} neighborhoods={neighborhoods}
   minPrice={minPrice} setMinPrice={setMinPrice} maxPrice={maxPrice} setMaxPrice={setMaxPrice}
   sort={sort} setSort={setSort}
   activeFilters={activeFilters} resultCount={results.length}
   onApply={applyFilters} onClose={()=>setFiltersOpen(false)} onClearAll={clearAllFilters}
  />}
 {!hasRequest?<section className="search26-start"><div className="search26-start__intro"><div className="search26-start-icon"><PackageSearch/></div><div><h2>Pesquise ou abra uma comparação.</h2><p>Escolha uma sugestão abaixo ou use os filtros para chegar direto ao que procura.</p></div><div className="search26-suggestions"><button onClick={()=>{setQuery("arroz");setAppliedQuery("arroz")}}>Arroz</button><button onClick={()=>{setQuery("café");setAppliedQuery("café")}}>Café</button><button onClick={()=>setFiltersOpen(true)}>Usar filtros</button></div></div>{featuredProducts.length>0&&<div className="search26-featured"><header><div><h3>Comparações rápidas</h3></div><small>Clique para ver preços e lojas</small></header><div>{featuredProducts.map(product=><div role="button" tabIndex={0} className="search26-featured-card" key={product.id} {...openProductOnActivate(product)}><div className="search26-thumb"><ProductThumb product={product}/><ProductCardActions product={product} className="pca-row--overlay pca-row--compact"/></div><span><small>{formatCategoryLabel(product.category)}</small><strong>{product.name}</strong><em>{product.storeCount||product.offers?.length||1} lojas</em></span><b>{brl.format(product.minPrice)}</b><ArrowRight aria-hidden="true"/></div>)}</div></div>}</section>:
 <section className="search26-results"><header><div><h2 aria-live="polite">{loading?"Consultando catálogo…":`${results.length} ${results.length===1?"resultado":"resultados"}`}</h2></div><small>Selecione um produto para comparar preços</small></header>{!loading&&results.length>0?(()=>{
  const pageCount=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
  const safePage=Math.min(page,pageCount);
  const startResult=results.length?(safePage-1)*PAGE_SIZE+1:0;
  const endResult=Math.min(safePage*PAGE_SIZE,results.length);
  const visibleResults=results.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  const shownResults=isGuest?visibleResults.slice(0,FREE_PREVIEW_LIMIT):visibleResults;
  const teaserResults=isGuest?visibleResults.slice(FREE_PREVIEW_LIMIT,FREE_PREVIEW_LIMIT+3):[];
  const lockedCount=isGuest?Math.max(0,results.length-FREE_PREVIEW_LIMIT):0;
  const signupHref=`/cadastro?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  return <>
   <div className="search26-grid">
    {shownResults.map(product=><div role="button" tabIndex={0} className="search26-card ref-catalog-card" key={product.id} {...openProductOnActivate(product)} aria-haspopup="dialog"><div className="search26-thumb"><ProductThumb product={product}/><ProductCardActions product={product} className="pca-row--overlay pca-row--compact"/></div><div className="search26-copy"><small>{formatCategoryLabel(product.category)} · {product.brand}</small><strong>{product.name}</strong><span><Store/>{product.establishment}<em>{product.neighborhood}</em></span></div><div className="search26-price"><small>menor preço</small><strong>{brl.format(product.minPrice)}</strong><em>{product.storeCount||product.offers?.length||1} {(product.storeCount||product.offers?.length||1)===1?"estabelecimento":"estabelecimentos"}</em></div><ArrowRight/></div>)}
    {teaserResults.map(product=><Link to={signupHref} className="search26-card search26-card--teaser" key={product.id} aria-label={`Crie sua conta para ver o preço de ${product.name}`}><div className="search26-thumb"><ProductThumb product={product}/></div><div className="search26-copy"><small>{product.category} · {product.brand}</small><strong>{product.name}</strong><span><Store/>{product.establishment}<em>{product.neighborhood}</em></span></div><div className="search26-price search26-price--blurred"><small>menor preço</small><strong>{brl.format(product.minPrice)}</strong><em>{product.storeCount||product.offers?.length||1} lojas</em></div><i className="search26-card__lock"><LockKeyhole aria-hidden="true"/></i></Link>)}
   </div>
   {lockedCount>0?<div className="search26-gate"><div className="search26-gate__icon"><Sparkles aria-hidden="true"/></div><div className="search26-gate__copy"><h3>Veja os outros {lockedCount} {lockedCount===1?"preço":"preços"} desta busca</h3><p>Visitantes veem uma prévia do catálogo. Crie uma conta gratuita para comparar 100% dos preços e estabelecimentos de Feijó.</p></div><div className="search26-gate__actions"><Link className="pc-btn pc-btn--primary" to={signupHref}><UserPlus aria-hidden="true"/> Criar conta grátis</Link><Link className="search26-gate__login" to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>Já tenho conta</Link></div></div>:pageCount>1&&<nav className="store-pro-pagination" aria-label="Paginação dos resultados">
    <span>Mostrando {startResult}-{endResult} de {results.length}</span>
    <div>
     <button type="button" disabled={safePage===1} onClick={()=>setPage(v=>Math.max(1,v-1))} aria-label="Página anterior"><ChevronLeft/></button>
     {Array.from({length:pageCount},(_,index)=>index+1).filter(number=>number===1||number===pageCount||Math.abs(number-safePage)<=1).map((number,index,list)=><span key={number}>{index>0&&number-list[index-1]>1&&<i>…</i>}<button type="button" className={number===safePage?"is-active":""} aria-current={number===safePage?"page":undefined} onClick={()=>setPage(number)}>{number}</button></span>)}
     <button type="button" disabled={safePage===pageCount} onClick={()=>setPage(v=>Math.min(pageCount,v+1))} aria-label="Próxima página"><ChevronRight/></button>
    </div>
   </nav>}
  </>;
 })():!loading&&<div className="search26-empty"><PackageSearch/><h2>Nenhum resultado compatível</h2><p>Tente outra marca, confira a escrita ou limpe os filtros para ampliar a busca.</p><button type="button" onClick={reset}>Limpar busca e filtros</button></div>}</section>}
 </main><PublicFooter /><AppDock current="search" />{selectedProduct&&<ProductComparisonModal product={selectedProduct} onClose={closeProduct}/>}</div>}
