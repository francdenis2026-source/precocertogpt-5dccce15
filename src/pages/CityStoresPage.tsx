import establishmentsHero from "../assets/sectors-2026/sector-markets-v3.jpg";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Building2, Home, MapPin, PackageSearch, Store, Tag, TrendingDown } from "lucide-react";
import { fetchCatalog } from "../data/remoteCatalog";
import type { CatalogPayload, Product, StoreRow } from "../data/catalog";
import { CategoryOffers } from "../components/offers/CategoryOffers";
import { ProductThumb } from "../components/catalog/ProductThumb";
import { cities, cityForNeighborhood, cityLabel, findCity, type CityDefinition } from "../data/cities";
import { PublicFooter } from "../reference/PublicChrome";
import "./CityStoresPage.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type CityCatalog = { stores: StoreRow[]; products: Product[] };

function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void fetchCatalog()
      .then(result => {
        if (alive) setCatalog(result);
      })
      .catch(() => {
        if (alive) setCatalog(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { catalog, loading };
}

function groupByCity(catalog: CatalogPayload | null) {
  const map = new Map<string, CityCatalog>();
  for (const city of cities) map.set(city.slug, { stores: [], products: [] });
  if (!catalog) return map;
  for (const store of catalog.stores) {
    const city = cityForNeighborhood(store.neighborhood);
    map.get(city.slug)?.stores.push(store);
  }
  for (const product of catalog.products) {
    const city = cityForNeighborhood(product.neighborhood);
    map.get(city.slug)?.products.push(product);
  }
  return map;
}

/** Índice de cidades atendidas — conectado ao catálogo real do painel admin. */
export function CityDirectoryPage() {
  const { catalog, loading } = useCatalog();
  const grouped = useMemo(() => groupByCity(catalog), [catalog]);

  return (
    <main className="city-page" id="conteudo-principal">
      <Helmet>
        <title>Lojas por cidade | Preço Certo</title>
        <meta
          name="description"
          content="Escolha sua cidade e veja lojas, preços por estabelecimento e promoções ativas cadastradas no Preço Certo."
        />
        <link rel="canonical" href="https://precocerto.live/cidades" />
      </Helmet>

      <nav className="city-back" aria-label="Navegação de retorno">
        <Link to="/">
          <Home aria-hidden="true" />
          Início
        </Link>
      </nav>

      <header className="city-hero city-hero--editorial"><div className="city-hero-backdrop" aria-hidden="true"><img src={establishmentsHero} alt="" /></div>
        <span className="city-kicker">
          <MapPin aria-hidden="true" />
          Cobertura da plataforma
        </span>
        <h1>Lojas e preços por cidade</h1>
        <p>
          Cada cidade reúne os estabelecimentos cadastrados no painel administrativo, com preços por loja e as
          promoções publicadas na aba de Ofertas.
        </p>
      </header>

      <section className="city-grid" aria-label="Cidades atendidas">
        {cities.map(city => {
          const data = grouped.get(city.slug);
          return (
            <Link key={city.slug} className="city-card" to={`/cidade/${city.slug}`}>
              <strong>{cityLabel(city)}</strong>
              <span>{city.description}</span>
              <div className="city-card-metrics">
                <em>
                  <Store aria-hidden="true" />
                  {loading ? "—" : `${data?.stores.length ?? 0} lojas`}
                </em>
                <em>
                  <PackageSearch aria-hidden="true" />
                  {loading ? "—" : `${data?.products.length ?? 0} produtos`}
                </em>
              </div>
            </Link>
          );
        })}
      </section>
      <PublicFooter />
    </main>
  );
}

/** Página de uma cidade: lojas, produtos com preço e promoções ativas. */
export function CityStoresPage() {
  const { city: slug } = useParams();
  const city = findCity(slug);
  const { catalog, loading } = useCatalog();

  const data = useMemo<CityCatalog>(() => {
    if (!city) return { stores: [], products: [] };
    const grouped = groupByCity(catalog);
    return grouped.get(city.slug) || { stores: [], products: [] };
  }, [catalog, city]);

  const products = useMemo(
    () => [...data.products].sort((a, b) => a.minPrice - b.minPrice).slice(0, 24),
    [data.products],
  );

  if (!city) {
    return (
      <main className="city-page" id="conteudo-principal">
        <header className="city-hero">
          <h1>Cidade não encontrada</h1>
          <p>Confira a lista de cidades atendidas pelo Preço Certo.</p>
        </header>
        <nav className="city-back">
          <Link to="/cidades">
            <ArrowLeft aria-hidden="true" />
            Ver cidades
          </Link>
        </nav>
      </main>
    );
  }

  const cheapest = products[0];

  return (
    <main className="city-page" id="conteudo-principal">
      <Helmet>
        <title>{`Lojas e preços em ${city.name} - ${city.state} | Preço Certo`}</title>
        <meta name="description" content={city.description.slice(0, 158)} />
        <link rel="canonical" href={`https://precocerto.live/cidade/${city.slug}`} />
      </Helmet>

      <nav className="city-back" aria-label="Navegação de retorno">
        <Link to="/">
          <Home aria-hidden="true" />
          Início
        </Link>
        <Link to="/cidades">
          <ArrowLeft aria-hidden="true" />
          Todas as cidades
        </Link>
      </nav>

      <header className="city-hero city-hero--editorial" data-city={city.slug}><div className="city-hero-backdrop" aria-hidden="true"><img src="/editorial-2026/business-1280.webp" alt="" /></div>
        <span className="city-kicker">
          <MapPin aria-hidden="true" />
          {cityLabel(city)}
        </span>
        <h1>{city.headline}</h1>
        <p>{city.description}</p>
        <div className="city-hero-metrics">
          <span>
            <Store aria-hidden="true" />
            <strong>{loading ? "—" : data.stores.length}</strong> estabelecimentos
          </span>
          <span>
            <PackageSearch aria-hidden="true" />
            <strong>{loading ? "—" : data.products.length}</strong> produtos com preço
          </span>
          {cheapest && (
            <span>
              <TrendingDown aria-hidden="true" />
              menor preço hoje <strong>{brl.format(cheapest.minPrice)}</strong>
            </span>
          )}
        </div>
      </header>

      <CategoryOffers categorySlug={null} title={`Promoções ativas em ${city.name}`} limit={6} />

      <section className="city-section" aria-labelledby="city-stores-title">
        <h2 id="city-stores-title">
          <Building2 aria-hidden="true" />
          Estabelecimentos em {city.name}
        </h2>
        {loading ? (
          <p className="city-empty">Carregando estabelecimentos…</p>
        ) : data.stores.length === 0 ? (
          <p className="city-empty">
            Nenhum estabelecimento cadastrado nesta cidade ainda. Cadastre no painel administrativo e a lista aparece
            aqui automaticamente.
          </p>
        ) : (
          <ul className="city-store-list">
            {data.stores.map(store => (
              <li key={String(store.id)}>
                <Link to={`/estabelecimento/${store.slug}`}>
                  {store.photoUrl || store.logoUrl ? (
                    <img
                      className="city-store-photo"
                      src={store.photoUrl || store.logoUrl}
                      alt={`Fachada de ${store.name}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span
                      className="city-store-photo city-store-photo--fallback"
                      style={{ ["--store-color" as string]: store.color }}
                      aria-hidden="true"
                    >
                      {store.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <strong>{store.name}</strong>
                  <small>{[store.neighborhood, store.city].filter(Boolean).join(" · ")}</small>
                  {store.address && <span className="city-store-address">{store.address}</span>}
                  {store.openingHours && <span className="city-store-hours">{store.openingHours}</span>}
                  <em>{store.products} produtos com preço</em>
                </Link>
              </li>
            ))}
          </ul>

        )}
      </section>

      <section className="city-section" aria-labelledby="city-products-title">
        <h2 id="city-products-title">
          <Tag aria-hidden="true" />
          Melhores preços em {city.name}
        </h2>
        {loading ? (
          <p className="city-empty">Carregando preços…</p>
        ) : products.length === 0 ? (
          <p className="city-empty">Cadastre produtos e preços por loja no painel para preencher esta lista.</p>
        ) : (
          <ul className="city-product-grid">
            {products.map(product => (
              <li key={String(product.id)}>
                <Link to={`/produto/${product.slug}`}>
                  <ProductThumb product={product} size="sm" />
                  <strong>{product.name}</strong>
                  <small>{product.establishment}</small>
                  <b>{brl.format(product.minPrice)}</b>
                  {product.storeCount > 1 && <em>{product.storeCount} lojas comparadas</em>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}
