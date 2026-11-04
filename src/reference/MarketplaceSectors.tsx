import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, Croissant, Grid2X2, HeartPulse, LockKeyhole, MapPin, Pill, Plus, Sandwich, Scale, ShieldCheck, ShoppingBasket, Sparkles, Store, UserPlus, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { CatalogPayload } from "../data/catalog";
import { businessGroups, type BusinessGroupId } from "../data/businessTaxonomy";
import { fetchSectorCatalog, prefetchSectorCatalog, sectorProducts, sectorStores } from "../data/sectorCatalog";
import { getStoreLogoUrl } from "../data/storeLogos";
import { sectorHeroImage } from "../data/sectorHeroImages";
import { AppDock, PublicHeader } from "./PublicChrome";
import { CategoryOffers } from "../components/offers/CategoryOffers";
import { ProductThumb as CatalogProductThumb } from "../components/catalog/ProductThumb";
import { useFavorites } from "../features/favorites/FavoritesProvider";
import { usePriceVisibility } from "../hooks/usePriceVisibility";
import "./PharmacyDirectory.css";
import "./CulturalProfiles.css";

const SECTOR_FREE_PREVIEW_LIMIT = 4;

/* "Setor" saiu de toda a interface. A palavra é de quem monta a plataforma,
 * não de quem compra: ninguém em Feijó diz "vou olhar o setor de padarias".
 * O que a pessoa quer saber é ONDE COMPRAR uma coisa — então é esse o nome
 * usado na navegação, e cada item é uma "categoria" (palavra que todo mundo
 * já conhece de qualquer loja online). Os identificadores internos e as URLs
 * continuam os mesmos para não quebrar links já existentes. */

export type MarketplaceSectorId = BusinessGroupId | "all";
export type MarketplaceSector = {
  id: BusinessGroupId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  searchHint: string;
  href: string;
  icon: LucideIcon;
  examples: string[];
};

/* Apresentação de cada categoria. A composição dos grupos (quais tipos de
 * negócio entram em cada um) vive em businessTaxonomy.ts — aqui só entra o
 * que é texto e ícone, para os dois nunca saírem de sincronia. */
const PRESENTATION: Record<BusinessGroupId, Pick<MarketplaceSector, "eyebrow" | "title" | "description" | "searchHint" | "icon">> = {
  markets: {
    eyebrow: "COMPRAS DO DIA A DIA",
    title: "Mercados e mercearias de Feijó",
    description: "Compare o preço do arroz, do café, da limpeza e da bebida entre os mercados da cidade antes de sair de casa.",
    searchHint: "Arroz, café, sabão ou o nome do mercado…",
    icon: ShoppingBasket,
  },
  butchers: {
    eyebrow: "CARNES E CORTES",
    title: "Açougues e peixarias de Feijó",
    description: "Carne, frango e peixe: veja quem vende, onde fica e a que preço, sem precisar rodar a cidade perguntando.",
    searchHint: "Carne, frango, peixe ou o nome do açougue…",
    icon: Scale,
  },
  bakery: {
    eyebrow: "PÃO, BOLO E SALGADOS",
    title: "Padarias e confeitarias de Feijó",
    description: "Pão feito na hora, bolo, salgado e doce, com o preço de cada casa à vista.",
    searchHint: "Pão, bolo, salgado ou o nome da padaria…",
    icon: Croissant,
  },
  food: {
    eyebrow: "LANCHE E REFEIÇÃO",
    title: "Lanchonetes, pizzarias e restaurantes",
    description: "Cardápio completo com preço aberto, do hambúrguer à pizza, para decidir antes de pedir.",
    searchHint: "Hambúrguer, pizza, açaí ou o nome da lanchonete…",
    icon: Sandwich,
  },
  pharmacies: {
    eyebrow: "SAÚDE E CUIDADO",
    title: "Farmácias de Feijó",
    description: "Medicamentos, higiene e cuidados pessoais nas farmácias que já publicam preço na plataforma.",
    searchHint: "Remédio, higiene ou o nome da farmácia…",
    icon: Pill,
  },
  books: {
    eyebrow: "CULTURA LOCAL",
    title: "Livros, autores e cultura",
    description: "Autores, obras e projetos culturais da cidade, com espaço próprio, sem serem tratados como loja de produto.",
    searchHint: "Título, autor ou projeto cultural…",
    icon: BookOpen,
  },
  services: {
    eyebrow: "PROFISSIONAIS DA CIDADE",
    title: "Serviços e profissionais",
    description: "Quem faz o serviço, onde atende e como falar direto, sem produto inventado no meio.",
    searchHint: "Serviço, profissão ou especialidade…",
    icon: BriefcaseBusiness,
  },
  other: {
    eyebrow: "COMÉRCIO LOCAL",
    title: "Outros comércios de Feijó",
    description: "Negócios já cadastrados que ainda não se encaixam numa categoria específica. Assim que o tipo do negócio for informado, cada um vai para o seu lugar.",
    searchHint: "Nome do comércio ou produto…",
    icon: Store,
  },
};

export const marketplaceSectors: MarketplaceSector[] = businessGroups.map(group => ({
  id: group.id,
  label: group.label,
  shortLabel: group.shortLabel,
  href: group.href,
  examples: group.examples,
  ...PRESENTATION[group.id],
}));

/** As categorias que aparecem na navegação principal. "Outros comércios"
 *  existe como destino honesto para cadastros incompletos, mas não merece
 *  espaço fixo no menu ao lado de "Padarias" e "Açougues". */
export const primarySectors = marketplaceSectors.filter(sector => sector.id !== "other");

export function getMarketplaceSector(value: string | null | undefined) {
  return marketplaceSectors.find(sector => sector.id === value) || null;
}

export function SectorNavigator({ active = "all", compact = false, counts }: { active?: MarketplaceSectorId; compact?: boolean; counts?: Partial<Record<MarketplaceSectorId, number>> }) {
  const warm = () => prefetchSectorCatalog();
  return (
    <nav className={`sector-nav${compact ? " sector-nav--compact" : ""}`} aria-label="Onde comprar">
      <Link className={active === "all" ? "is-active" : ""} to="/explorar">
        <Grid2X2 />
        <span><strong>Ver tudo</strong><small>Todas as categorias</small></span>
      </Link>
      {primarySectors.map(sector => (
        <Link key={sector.id} className={active === sector.id ? "is-active" : ""} to={sector.href} onPointerEnter={warm} onFocus={warm}>
          <sector.icon />
          <span>
            <strong>{sector.shortLabel}</strong>
            <small>{counts?.[sector.id] !== undefined ? `${counts[sector.id]} ${counts[sector.id] === 1 ? "estabelecimento" : "estabelecimentos"}` : sector.examples.slice(0, 2).join(" · ")}</small>
          </span>
        </Link>
      ))}
    </nav>
  );
}

function CulturalProfiles() {
  return (
    <div className="sector-profile-grid">
      <Link to="/dorinha-barroso">
        <BookOpen />
        <span><small>AUTORA</small><strong>Dorinha Barroso</strong><p>Página dedicada para conhecer a autora e seus conteúdos culturais.</p></span>
        <ArrowRight />
      </Link>
      <Link to="/fremix-producoes">
        <Store />
        <span><small>PROJETO CULTURAL</small><strong>Fremix Produções</strong><p>Espaço próprio para iniciativas e conteúdos culturais locais.</p></span>
        <ArrowRight />
      </Link>
    </div>
  );
}

function PharmacyStoreMark({ name, color }: { name: string; color: string }) {
  const [failed, setFailed] = useState(false);
  const logo = getStoreLogoUrl(name);
  const showLogo = Boolean(logo) && !failed;
  return <i className={`pharmacy-establishment__mark${showLogo ? " has-logo" : ""}`} style={{ "--store-color": color } as CSSProperties}>
    {showLogo ? <img src={logo} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Plus aria-hidden="true" />}
  </i>;
}

function DirectoryFooter({ sector }: { sector: MarketplaceSector }) {
  return <footer className="pharmacy-footer">
    <div className="pharmacy-footer__inner">
      <div className="pharmacy-footer__brand">
        <Link to="/" aria-label="PreçoCerto, página inicial"><img src="/logo-preco-certo-inversa.svg" alt="PreçoCerto" /></Link>
        <span><ShieldCheck aria-hidden="true" /> Informação local organizada com responsabilidade.</span>
      </div>
      <nav aria-label={`Atalhos de ${sector.shortLabel}`}>
        <Link to={sector.href}>{sector.shortLabel}</Link>
        <Link to="/buscar">Buscar produtos</Link>
        <Link to="/estabelecimentos">Estabelecimentos</Link>
        <Link to="/contato">Fale conosco</Link>
      </nav>
      <p>Preços e disponibilidade podem mudar. Confirme diretamente com o estabelecimento antes da compra.</p>
    </div>
    <small>© 2026 PreçoCerto · Feijó, Acre · dev {"<Franc D’nis>"}</small>
  </footer>;
}

function SectorProductList({ catalog, sector }: { catalog: CatalogPayload | null; sector: MarketplaceSector }) {
  const location = useLocation();
  const { userId } = useFavorites();
  const { allPricesVisible } = usePriceVisibility();
  const isGuest = !userId && !allPricesVisible;
  if (!catalog) return null;
  const allProducts = sectorProducts(catalog, sector);
  const products = allProducts.slice(0, 12);
  if (!products.length) return null;
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const shownProducts = isGuest ? products.slice(0, SECTOR_FREE_PREVIEW_LIMIT) : products;
  const teaserProducts = isGuest ? products.slice(SECTOR_FREE_PREVIEW_LIMIT) : [];
  const lockedTotal = isGuest ? Math.max(0, allProducts.length - SECTOR_FREE_PREVIEW_LIMIT) : 0;
  const signupHref = `/cadastro?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  return <section className="sector-product-list" aria-label={`Produtos de ${sector.shortLabel}`}>
    <div className="sector-product-list__heading">
      <div><span>PRODUTOS PUBLICADOS</span><h2>Itens com preço nesta categoria</h2></div>
      <Link to="/buscar">Ver todos <ArrowRight aria-hidden="true" /></Link>
    </div>
    <div className="sector-product-list__grid">
      {shownProducts.map(product => (
        <Link key={product.id} className="sector-product-card" to={`/produto/${product.slug || product.id}`}>
          <span className="sector-product-card__media"><CatalogProductThumb product={product} size="md" /></span>
          <small>{[product.brand, product.size].filter(Boolean).join(" · ") || sector.shortLabel}</small>
          <strong>{product.name}</strong>
          <span className="sector-product-card__store"><Store aria-hidden="true" /> {product.establishment}</span>
          <span className="sector-product-card__price"><em>Menor preço</em><b>{money(product.minPrice)}</b></span>
        </Link>
      ))}
      {teaserProducts.map(product => (
        <Link key={product.id} className="sector-product-card sector-product-card--teaser" to={signupHref} aria-label={`Crie sua conta para ver o preço de ${product.name}`}>
          <span className="sector-product-card__media"><CatalogProductThumb product={product} size="md" /></span>
          <small>{[product.brand, product.size].filter(Boolean).join(" · ") || sector.shortLabel}</small>
          <strong>{product.name}</strong>
          <span className="sector-product-card__store"><Store aria-hidden="true" /> {product.establishment}</span>
          <span className="sector-product-card__price sector-product-card__price--blurred"><em>Menor preço</em><b>{money(product.minPrice)}</b></span>
          <i className="sector-product-card__lock"><LockKeyhole aria-hidden="true" /></i>
        </Link>
      ))}
    </div>
    {isGuest && lockedTotal > 0 && <div className="sector-product-gate"><div className="sector-product-gate__icon"><Sparkles aria-hidden="true" /></div><div className="sector-product-gate__copy"><h3>Veja mais {lockedTotal} {lockedTotal === 1 ? "preço" : "preços"} nesta categoria</h3><p>Visitantes veem uma prévia. Crie uma conta gratuita para comparar 100% dos preços de {sector.shortLabel.toLowerCase()} em Feijó.</p></div><div className="sector-product-gate__actions"><Link className="pc-btn pc-btn--primary" to={signupHref}><UserPlus aria-hidden="true" /> Criar conta grátis</Link><Link className="sector-product-gate__login" to={loginHref}>Já tenho conta</Link></div></div>}
  </section>;
}

function CompactSectorDirectory({ catalog, sector, error, onRetry }: { catalog: CatalogPayload | null; sector: MarketplaceSector; error: boolean; onRetry: () => void }) {
  const Icon = sector.icon;
  const stores = catalog ? sectorStores(catalog, sector) : [];
  const isPharmacy = sector.id === "pharmacies";
  // Cada tipo de estabelecimento tem sua própria fotografia de hero.
  const heroStyle = { "--sector-hero": `url(${sectorHeroImage(sector.id)})` } as CSSProperties;

  return <div className={`pharmacy-directory-page${isPharmacy ? " pharmacy-directory-page--pharmacies" : ""}`}>
    <PublicHeader backOnly title={sector.shortLabel} />
    <main id="conteudo-principal" className="pharmacy-directory">
      {isPharmacy ? <header className="pharmacy-directory__hero pc26-sector-hero" style={heroStyle}>
        <div className="pharmacy-directory__hero-copy">
          <span><HeartPulse aria-hidden="true" /> SAÚDE PERTO DE VOCÊ</span>
          <h1>Farmácias em Feijó</h1>
          <p>Encontre estabelecimentos cadastrados, confira a disponibilidade do catálogo e acesse as informações de cada farmácia.</p>
          <div className="pharmacy-directory__hero-meta">
            <strong><ShieldCheck aria-hidden="true" /> Perfis ativos na plataforma</strong>
            <small aria-live="polite">{catalog ? `${stores.length} ${stores.length === 1 ? "estabelecimento" : "estabelecimentos"}` : "Atualizando diretório"}</small>
          </div>
        </div>
      </header> : <header className="pharmacy-directory__heading pc26-sector-hero" style={heroStyle}>
        <div>
          <span><Icon aria-hidden="true" /> {sector.eyebrow}</span>
          <h1>{sector.shortLabel}</h1>
        </div>
        <p aria-live="polite">{sector.id === "books" ? "2 perfis culturais" : catalog ? `${stores.length} ${stores.length === 1 ? "estabelecimento ativo" : "estabelecimentos ativos"}` : "Carregando estabelecimentos"}</p>
      </header>}

      {isPharmacy && <div className="pharmacy-directory__list-heading"><div><span>DIRETÓRIO LOCAL</span><h2>Estabelecimentos cadastrados</h2></div><p>Informações disponíveis no PreçoCerto</p></div>}

      {sector.id === "books" ? <CulturalProfiles /> : error ? <section className="pharmacy-directory__state" role="alert">
        <strong>Não foi possível carregar os estabelecimentos.</strong>
        <p>Verifique sua conexão e tente novamente.</p>
        <button className="pc-retry-button" type="button" onClick={onRetry}>Tentar novamente</button>
      </section> : !catalog ? <section className="pharmacy-directory__state" aria-busy="true">
        <span className="pharmacy-directory__loader" />
        <strong>Buscando estabelecimentos cadastrados…</strong>
      </section> : stores.length ? <section className="pharmacy-directory__list" aria-label={`${sector.shortLabel} ativos em Feijó`}>
        {stores.map(({ store, count }) => {
          return <article className="pharmacy-establishment" key={store.id}>
          {isPharmacy ? <PharmacyStoreMark name={store.name} color={store.color} /> : <i className="pharmacy-establishment__mark" style={{ "--store-color": store.color } as CSSProperties}><Icon aria-hidden="true" /></i>}
          <div className="pharmacy-establishment__identity">
            <span>{isPharmacy ? <ShieldCheck aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />} ESTABELECIMENTO ATIVO</span>
            <h2>{store.name}</h2>
            <p><MapPin aria-hidden="true" /> {store.neighborhood || "Feijó, Acre"}</p>
          </div>
          <div className="pharmacy-establishment__catalog">
            <small>CATÁLOGO</small>
            <strong>{count ? `${count} ${count === 1 ? "item publicado" : "itens publicados"}` : "Perfil disponível"}</strong>
          </div>
          <Link
            className="pharmacy-establishment__action"
            to={`/estabelecimento/${store.slug || store.id}${sector.id === "butchers" ? "?categoria=acougue" : ""}`}
          >
            Abrir estabelecimento <ArrowRight aria-hidden="true" />
          </Link>
        </article>})}
      </section> : <section className="pharmacy-directory__state">
        <Icon aria-hidden="true" />
        <strong>Nenhum estabelecimento ativo nesta categoria.</strong>
      </section>}

      {sector.id !== "books" && <CategoryOffers categorySlug={sector.id} title={`Ofertas em ${sector.label}`} />}
      {sector.id !== "books" && <SectorProductList catalog={catalog} sector={sector} />}
    </main>

    <DirectoryFooter sector={sector} />
    <AppDock current="stores" />
  </div>;
}

/* Recebe o id da categoria, nao o objeto pronto. Assim App.tsx monta as rotas
   so com a taxonomia (dado puro) e carrega esta tela sob demanda, em vez de
   importar este modulo, e todo o CSS que ele arrasta, no primeiro load. */
export function MarketplaceSectorLanding({ sectorId }: { sectorId: BusinessGroupId }) {
  const sector = getMarketplaceSector(sectorId);
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchSectorCatalog().then(data => { if (active) setCatalog(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (!sector) return null;
  return <CompactSectorDirectory catalog={catalog} sector={sector} error={error} onRetry={() => { setError(false); setAttempt(value => value + 1); }} />;
}
