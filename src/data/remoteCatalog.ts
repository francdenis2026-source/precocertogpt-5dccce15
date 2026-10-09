import { supabase } from "../lib/supabase";
import {
  buildCatalog,
  verifiedDatasetMetrics,
  type CatalogPayload,
  type PlatformMetrics,
  type Product,
  type StoreRow,
} from "./catalog";
import { withManualAdditions } from "./manualEstablishments";

/**
 * "products" por loja aqui é contado a partir da tabela de preços do
 * comparador geral (productIdsByStore, abaixo) — mas o acervo de uma autora
 * como a Dorinha Barroso não passa por essa tabela: os livros vivem no campo
 * `books` do perfil da lojista (lido via RPC `author_store_public_profile`
 * em DorinhaEditorialPage/DorinhaCommerceEnhancer), então o card dela sempre
 * mostrava "0 produtos no catálogo" mesmo com o acervo completo publicado.
 * Override pontual só para esse tipo de vitrine, casado pelo slug real do
 * estabelecimento (o mesmo usado na RPC e em PublicEstablishmentCatalog).
 */
export const NON_PRICE_CATALOG_COUNTS: Record<string, number> = {
  "dorinha-barroso-livros": 4,
  // FreMix Produções: acervo é o canal do YouTube (vídeos), não passa pela
  // tabela de preços do comparador geral. 118 vídeos conferidos no canal
  // oficial em set/2026 (ver src/components/FremixProductionsPage.tsx).
  "fremix-producoes": 118,
};

type EstablishmentRow = {
  id: string;
  slug: string | null;
  name: string | null;
  neighborhood: string | null;
  brand_color: string | null;
  kind?: string | null;
  /** `address` é JSONB no banco (rua, número, bairro, cidade…) ou texto simples. */
  address?: string | Record<string, unknown> | null;
  logo_url?: string | null;
  /** Colunas opcionais (criadas em db/sql/fase2_ofertas_lojas_cidades.sql). */
  city?: string | null;
  opening_hours?: string | null;
  storefront_image_url?: string | null;
  whatsapp?: string | null;
};


/** Converte o endereço (JSONB ou texto) em uma linha legível para as vitrines. */
function formatStoreAddress(raw: EstablishmentRow["address"]): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  const get = (key: string) => {
    const value = raw[key];
    return typeof value === "string" && value.trim() ? value.trim() : "";
  };
  const street = [get("street"), get("number")].filter(Boolean).join(", ");
  const line = [street, get("neighborhood"), get("city")].filter(Boolean).join(" · ");
  return line || undefined;
}

/** Cidade declarada no endereço estruturado, quando existir. */
function storeCityFrom(raw: EstablishmentRow["address"]): string | undefined {
  if (!raw || typeof raw === "string") return undefined;
  const value = raw.city;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

type ProductRow = {
  id: string | number;
  slug: string | null;
  name: string | null;
  brand: string | null;
  category: string | null;
  size: string | null;
  unit: string | null;
  barcode: string | null;
  image_url: string | null;
};

type PriceRow = {
  product_id: string;
  establishment_id: string;
  value: number | string | null;
  previous_value: number | string | null;
  captured_at: string | null;
  source?: string;
};

export type CatalogSource = "supabase" | "local";

export type CatalogResult = CatalogPayload & { source: CatalogSource; error?: string };

const round = (value: number) => Math.round(value * 100) / 100;
const toNumber = (value: number | string | null) => (value === null ? NaN : Number(value));
const DATABASE_PAGE_SIZE = 1000;
const CATALOG_CACHE_TTL_MS = 60 * 60_000; // egress: cada reload baixa o catálogo inteiro; 1h em vez de 5 min
const CATALOG_REQUEST_TIMEOUT_MS = 20_000;
const CATALOG_RETRY_DELAY_MS = 350;

let cachedCatalog: { value: CatalogResult; expiresAt: number } | null = null;
let pendingCatalog: Promise<CatalogResult> | null = null;

function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error("A consulta de preços excedeu 5 segundos.")), timeoutMs);
    request.then(value => {
      globalThis.clearTimeout(timer);
      resolve(value);
    }, error => {
      globalThis.clearTimeout(timer);
      reject(error);
    });
  });
}

const wait = (durationMs: number) => new Promise<void>(resolve => globalThis.setTimeout(resolve, durationMs));

export const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Gera um slug leg\u00edvel ("mercado-rebou\u00e7as" -> "mercado-reboucas") a partir do
// nome, em vez de expor o UUID interno na barra de endere\u00e7os. Quando dois
// registros geram o mesmo slug (nomes iguais/parecidos), acrescenta um sufixo
// curto e est\u00e1vel derivado do id para manter cada URL \u00fanica.
function slugifyName(name: string, fallbackId: string | number) {
  const base = normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${String(fallbackId).slice(0, 8)}`;
}

/* `getSlug` traz o slug que ja esta gravado no banco. Ele tem prioridade
 * porque e o mesmo endereco que o prerender de SEO e o sitemap publicam:
 * quando o app derivava tudo do nome, lojas cujo slug gravado nao batia com o
 * nome ("Comercio Bons Amigos" com slug "da-bons-amigos") abriam
 * "Estabelecimento nao encontrado" para quem chegava pela busca. */
function assignUniqueSlugs<T>(rows: T[], getName: (row: T) => string, getId: (row: T) => string | number, getSlug?: (row: T) => string | null | undefined) {
  const seen = new Map<string, number>();
  const slugById = new Map<string | number, string>();
  for (const row of rows) {
    const id = getId(row);
    const stored = (getSlug?.(row) || "").trim();
    if (stored) { slugById.set(id, stored); continue; }
    const base = slugifyName(getName(row), id);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${String(id).replace(/[^a-z0-9]/gi, "").slice(0, 6) || count}`;
    slugById.set(id, slug);
  }
  return slugById;
}

const normalizeCatalogTerm = (value: string) => normalize(value)
  .replace(/\bmistura lactea condensada\b/g, "leite condensado");

const exactWordCatalogTerms = new Set(["sal"]);

const catalogQueryMatches = (field: string, query: string) => {
  const fieldTokens = field.split(" ").filter(Boolean);
  const queryTokens = query.split(" ").filter(Boolean);
  return queryTokens.every(token => exactWordCatalogTerms.has(token)
    ? fieldTokens.includes(token)
    : field.includes(token));
};

const normalizeUnit = (value: string | null | undefined) => {
  const unit = normalize(value || "").replace(/[^a-z]/g, "");
  if (["un", "und", "unid", "unidade", "unidades"].includes(unit)) return "un";
  if (["pct", "pacote", "pacotes"].includes(unit)) return "pacote";
  if (["cx", "caixa", "caixas"].includes(unit)) return "caixa";
  if (["garrafa", "garrafas"].includes(unit)) return "garrafa";
  if (["frasco", "frascos"].includes(unit)) return "frasco";
  if (["lata", "latas"].includes(unit)) return "lata";
  if (["saco", "sacos"].includes(unit)) return "saco";
  return unit || "un";
};

const measurementToken = (amount: number, unit: string) => {
  const normalizedUnit = normalize(unit).replace(/[^a-z]/g, "");
  if (["kg", "quilo", "quilos", "kilograma", "kilogramas"].includes(normalizedUnit)) return `mass:${Math.round(amount * 1000)}g`;
  if (["g", "gr", "grama", "gramas"].includes(normalizedUnit)) return `mass:${Math.round(amount)}g`;
  if (["l", "lt", "litro", "litros"].includes(normalizedUnit)) return `volume:${Math.round(amount * 1000)}ml`;
  if (["ml", "mililitro", "mililitros"].includes(normalizedUnit)) return `volume:${Math.round(amount)}ml`;
  if (["un", "und", "unid", "unidade", "unidades"].includes(normalizedUnit)) return `count:${Math.round(amount)}un`;
  return `${amount}:${normalizedUnit}`;
};

const extractSpecification = (product: ProductRow) => {
  const source = normalize(`${product.size || ""} ${product.name || ""}`).replace(/,/g, ".");
  const unitPattern = "kg|quilo|quilos|kilograma|kilogramas|g|gr|grama|gramas|l|lt|litro|litros|ml|mililitro|mililitros|un|und|unid|unidade|unidades";
  const pack = source.match(new RegExp(`\\b(\\d+)\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (pack) return `pack:${Number(pack[1])}x${measurementToken(Number(pack[2]), pack[3])}`;

  const single = source.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (single) return measurementToken(Number(single[1]), single[2]);

  const size = normalize(product.size || "").replace(/[^a-z0-9]+/g, "");
  return size && size !== "-" ? `size:${size}` : `unit:${normalizeUnit(product.unit)}`;
};

const baseProductName = (value: string | null) => normalizeCatalogTerm(value || "")
  .replace(/\b\d+\s*x\s*\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|lt|ml|un|und|unid|unidade|unidades)\b/g, " ")
  .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grama|gramas|l|lt|litro|litros|ml|mililitro|mililitros|un|und|unid|unidade|unidades)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// Chave usada apenas na comparação: diferenças de espaço ou pontuação não
// podem separar cadastros do mesmo produto ("Dobom" e "Do Bom").
const productIdentityWords = (value: string | null) => baseProductName(value)
  .split(" ")
  .filter(Boolean)
  .map(word => word === "dobon" ? "dobom" : word);

// A ordem das mesmas palavras não cria outro produto. Assim,
// "Leite em Pó Italac Integral" e "Leite em Pó Integral Italac" usam a
// mesma identidade, mas palavras comercialmente relevantes (instantâneo,
// sachê, lata, sabor etc.) continuam impedindo uma união indevida.
const identityProductName = (value: string | null) => productIdentityWords(value).sort().join("");
const identityToken = (value: string | null) => normalize(value || "").replace(/[^a-z0-9]+/g, "");
const identityFor = (name: string) => identityProductName(name);
const isLeiteDobom = (product: ProductRow) => identityProductName(product.name) === identityFor("leite em pó dobom");

const identitySpecification = (product: ProductRow) => {
  // O cadastro legado sem gramagem corresponde ao mesmo Leite Dobom 400 g
  // presente nas demais lojas. Sem este alias, ele ficaria isolado como
  // "unit:un" e criaria um segundo cartão com preço divergente.
  if (isLeiteDobom(product)) return "mass:400g";
  return extractSpecification(product);
};

const officialProfileKey = (name: string, specification: string) => `${identityFor(name)}|${specification}`;
const OFFICIAL_PRODUCT_NAMES: Record<string, { name: string; brand: string; size: string }> = {
  [officialProfileKey("leite em pó dobom", "mass:400g")]: { name: "Leite em Pó Dobom 400 g", brand: "Dobom", size: "400 g" },
  [officialProfileKey("leite em pó integral italac", "mass:400g")]: { name: "Leite em Pó Integral Italac 400 g", brand: "Italac", size: "400 g" },
  [officialProfileKey("leite em pó integral itambé", "mass:400g")]: { name: "Leite em Pó Integral Itambé 400 g", brand: "Itambé", size: "400 g" },
  [officialProfileKey("leite em pó integral piracanjuba", "mass:400g")]: { name: "Leite em Pó Integral Piracanjuba 400 g", brand: "Piracanjuba", size: "400 g" },
  [officialProfileKey("leite em pó integral ninho", "mass:380g")]: { name: "Leite em Pó Integral NINHO 380 g", brand: "NINHO", size: "380 g" },
};
const publicProductProfile = (product: ProductRow) => OFFICIAL_PRODUCT_NAMES[`${identityProductName(product.name)}|${identitySpecification(product)}`];
const publicProductName = (product: ProductRow) => publicProductProfile(product)?.name
  ?? product.name
  ?? "Produto sem nome";

const productIdentity = (product: ProductRow) => product.barcode
  ? `barcode:${normalize(product.barcode)}`
  : [
      `name:${identityProductName(product.name)}`,
      `brand:${identityToken(product.brand)}`,
      `category:${identityToken(product.category)}`,
      `spec:${identitySpecification(product)}`,
    ].join("|");

/**
 * `products`/`prices` já passam de 3-4 mil linhas: paginar uma página de
 * cada vez, esperando cada `await` terminar antes de pedir a próxima,
 * transformava o carregamento inicial da home numa fila de 4-5 requisições
 * sequenciais de ~200-2600ms cada (a home ficava "cinza" por vários
 * segundos até tudo terminar). A primeira página já traz o total de linhas
 * (`count: "exact"`), então as páginas restantes — cujo número já é
 * conhecido de antemão — saem todas de uma vez em paralelo, limitadas pela
 * página mais lenta em vez da soma de todas.
 */
async function fetchAllRows(
  table: "establishments" | "products" | "prices",
  columns: string,
  orderColumn: string,
) {
  const first = await supabase!
    .from(table)
    .select(columns, { count: "exact" })
    .order(orderColumn, { ascending: true })
    .range(0, DATABASE_PAGE_SIZE - 1);

  if (first.error) return { data: [] as unknown[], error: first.error };

  const rows: unknown[] = [...(first.data ?? [])];
  const total = first.count ?? rows.length;

  const remainingStarts: number[] = [];
  for (let from = DATABASE_PAGE_SIZE; from < total; from += DATABASE_PAGE_SIZE) remainingStarts.push(from);

  if (remainingStarts.length) {
    const pages = await Promise.all(remainingStarts.map(from =>
      supabase!
        .from(table)
        .select(columns)
        .order(orderColumn, { ascending: true })
        .range(from, from + DATABASE_PAGE_SIZE - 1),
    ));
    for (const page of pages) {
      if (page.error) return { data: rows, error: page.error };
      rows.push(...(page.data ?? []));
    }
  }

  return { data: rows, error: null };
}

async function loadCatalog(query = ""): Promise<CatalogResult> {
  const local = buildCatalog(query);

  if (!supabase) {
    return { ...local, source: "local", error: "Supabase não configurado." };
  }

  try {
    const [establishments, products, prices] = await Promise.all([
      fetchAllRows("establishments", "id, name, slug, neighborhood, brand_color, kind, address, logo_url", "id"),
      fetchAllRows("products", "id, name, brand, category, size, unit, barcode, image_url", "id"),
      fetchAllRows("prices", "id, product_id, establishment_id, value, previous_value, captured_at", "id"),
    ]);

    const failure = establishments.error ?? products.error ?? prices.error;
    if (failure) {
      return { ...local, source: "local", error: failure.message };
    }

    const storeRows = (establishments.data ?? []) as unknown as EstablishmentRow[];
    const productRows = ((products.data ?? []) as unknown as ProductRow[]).filter(product =>
      normalize(product.name || "") !== "test product",
    );
    const priceRows = ((prices.data ?? []) as unknown as PriceRow[]).filter(row =>
      Number.isFinite(toNumber(row.value)),
    );

    if (!storeRows.length || !productRows.length || !priceRows.length) {
      return { ...local, source: "local", error: "Banco conectado, porém sem dados de preços." };
    }

    /**
     * Colunas opcionais de vitrine (cidade, horário, foto, WhatsApp). Só existem
     * depois de rodar db/sql/fase2_ofertas_lojas_cidades.sql — por isso a
     * consulta é separada e falha em silêncio quando ainda não foram criadas.
     */
    const storeExtras = new Map<string, Partial<EstablishmentRow>>();
    try {
      const { data: extraRows } = await supabase!
        .from("establishments")
        .select("id, city, opening_hours, storefront_image_url, whatsapp")
        .limit(2000);
      for (const row of (extraRows ?? []) as EstablishmentRow[]) storeExtras.set(String(row.id), row);
    } catch {
      /* colunas ainda não criadas: as páginas seguem com os dados básicos */
    }


    const q = normalizeCatalogTerm(query);
    const storesById = new Map(storeRows.map(store => [String(store.id), store]));
    const storeSlugById = assignUniqueSlugs(storeRows, store => store.name || "Estabelecimento", store => String(store.id), store => store.slug);
    const pricesByProductId = new Map<string, PriceRow[]>();
    const productIdsByStore = new Map<string, Set<string>>();

    priceRows.forEach(price => {
      const productId = String(price.product_id);
      const storeId = String(price.establishment_id);
      const productPrices = pricesByProductId.get(productId);
      if (productPrices) productPrices.push(price);
      else pricesByProductId.set(productId, [price]);

      const storeProducts = productIdsByStore.get(storeId);
      if (storeProducts) storeProducts.add(productId);
      else productIdsByStore.set(storeId, new Set([productId]));
    });

    const productPriceMap = new Map<string, PriceRow[]>();
    productRows.forEach(product => {
      const key = productIdentity(product);
      const rows = pricesByProductId.get(String(product.id)) || [];
      const groupedRows = productPriceMap.get(key);
      if (groupedRows) groupedRows.push(...rows);
      else productPriceMap.set(key, [...rows]);
    });

    const uniqueProductRows = Array.from(
      productRows.reduce((map, product) => {
        const key = productIdentity(product);
        const current = map.get(key);
        if (!current || (!current.image_url && product.image_url)) map.set(key, product);
        return map;
      }, new Map<string, ProductRow>()).values(),
    );

    const productSlugById = assignUniqueSlugs(uniqueProductRows, product => publicProductName(product), product => String(product.id));

    const mapped = uniqueProductRows
      .map((product): Product | null => {
        const key = productIdentity(product);
        const rows = productPriceMap.get(key) || [];
        if (!rows.length) return null;

        const latestByStore = Array.from(rows.reduce((map, row) => {
          const current = map.get(String(row.establishment_id));
          const incomingTime = Date.parse(row.captured_at || "") || 0;
          const currentTime = Date.parse(current?.captured_at || "") || 0;
          if (!current || incomingTime >= currentTime) map.set(String(row.establishment_id), row);
          return map;
        }, new Map<string, PriceRow>()).values());

        const values = latestByStore.map(row => toNumber(row.value)).filter(Number.isFinite);
        if (!values.length) return null;

        const best = latestByStore.reduce((lowest, row) =>
          toNumber(row.value) < toNumber(lowest.value) ? row : lowest,
        );
        const store = storesById.get(String(best.establishment_id));
        if (!store) return null;

        const previous = toNumber(best.previous_value);
        const normalizedProductName = normalize(product.name || "");
        const normalizedProductSize = normalize(product.size || "").replace(/\s+/g, "");
        const isLimpolPerfumes500ml = normalizedProductName.includes("limpol perfumes")
          && (normalizedProductName.includes("500ml") || normalizedProductSize === "500ml");

        return {
          id: product.id,
          slug: productSlugById.get(String(product.id)) || String(product.id),
          name: publicProductName(product),
          brand: publicProductProfile(product)?.brand ?? product.brand ?? "—",
          category: isLimpolPerfumes500ml ? "Desinfetante" : product.category ?? "Geral",
          size: publicProductProfile(product)?.size ?? product.size ?? "—",
          unit: product.unit ?? "un",
          barcode: product.barcode ?? undefined,
          minPrice: round(Math.min(...values)),
          avgPrice: round(values.reduce((total, value) => total + value, 0) / values.length),
          maxPrice: round(Math.max(...values)),
          storeCount: latestByStore.length,
          establishmentId: store.id,
          establishmentSlug: storeSlugById.get(String(store.id)) || String(store.id),
          establishment: store.name ?? "Estabelecimento",
          neighborhood: store.neighborhood ?? "—",
          storeColor: store.brand_color ?? "#1473E6",
          capturedAt: best.captured_at ?? new Date().toISOString(),
          previousPrice: Number.isFinite(previous) ? round(previous) : undefined,
          image_url: product.image_url || undefined,
          source: "Coleta Manual",
          updated_at: best.captured_at || undefined,
          offers: latestByStore.map(row => {
            const offerStore = storesById.get(String(row.establishment_id));
            const offerPrevious = toNumber(row.previous_value);
            return {
              establishmentId: row.establishment_id,
              establishmentSlug: storeSlugById.get(String(row.establishment_id)) || String(row.establishment_id),
              establishment: offerStore?.name ?? "Estabelecimento",
              neighborhood: offerStore?.neighborhood ?? "—",
              storeColor: offerStore?.brand_color ?? "#1473E6",
              value: round(toNumber(row.value)),
              capturedAt: row.captured_at ?? new Date().toISOString(),
              previousPrice: Number.isFinite(offerPrevious) ? round(offerPrevious) : undefined,
            };
          }).sort((a, b) => a.value - b.value),
          price_history: rows
            .map(row => ({ date: row.captured_at || new Date().toISOString(), value: toNumber(row.value) }))
            .filter(item => Number.isFinite(item.value))
            .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
        };
      })
      .filter((product): product is Product => product !== null)
      .filter(product => {
        if (!q) return true;
        const searchFields = [product.name, product.category, product.brand, product.barcode, product.size].filter(Boolean) as string[];
        const qNoSpace = q.replace(/\s+/g, "");
        return searchFields.some(field => {
          const normalizedField = normalizeCatalogTerm(field);
          if (catalogQueryMatches(normalizedField, q)) return true;
          // A forma sem espaços ajuda em nomes digitados juntos, mas não pode
          // furar a regra de palavra completa de termos como "sal".
          return !q.split(" ").some(token => exactWordCatalogTerms.has(token))
            && normalizedField.replace(/\s+/g, "").includes(qNoSpace);
        });
      })
      .sort((a, b) =>
        a.minPrice - b.minPrice ||
        a.name.localeCompare(b.name, "pt-BR") ||
        String(a.id).localeCompare(String(b.id)));

    const stores: StoreRow[] = storeRows
      .map(store => {
        const extra = storeExtras.get(String(store.id));
        const slug = storeSlugById.get(String(store.id)) || String(store.id);
        return {
          id: store.id,
          slug,
          name: store.name ?? "Estabelecimento",
          neighborhood: store.neighborhood ?? "—",
          color: store.brand_color ?? "#1473E6",
          kind: store.kind ?? undefined,
          address: formatStoreAddress(store.address),
          logoUrl: store.logo_url ?? undefined,
          city: storeCityFrom(store.address) ?? extra?.city ?? undefined,

          openingHours: extra?.opening_hours ?? undefined,
          photoUrl: extra?.storefront_image_url ?? undefined,
          whatsapp: extra?.whatsapp ?? undefined,
          products: NON_PRICE_CATALOG_COUNTS[slug] ?? (productIdsByStore.get(String(store.id))?.size ?? 0),
        };
      })

      .sort((a, b) => {
        const aHasCatalog = a.products > 0 ? 1 : 0;
        const bHasCatalog = b.products > 0 ? 1 : 0;
        if (aHasCatalog !== bHasCatalog) return bHasCatalog - aHasCatalog;
        if (aHasCatalog && bHasCatalog && a.products !== b.products) return b.products - a.products;
        return a.name.localeCompare(b.name, "pt-BR");
      });

    const metrics: PlatformMetrics = {
      products: productRows.length || verifiedDatasetMetrics.products,
      prices: priceRows.length || verifiedDatasetMetrics.prices,
      stores: storeRows.length || verifiedDatasetMetrics.stores,
    };

    const merged = withManualAdditions({ products: mapped, stores, metrics, updatedAt: new Date().toISOString() }, query);

    return {
      ...merged,
      source: "supabase",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o banco.";
    return { ...local, source: "local", error: message };
  }
}

async function loadCatalogResilient(query = ""): Promise<CatalogResult> {
  const local = buildCatalog(query);
  if (!supabase) return { ...local, source: "local", error: "Supabase não configurado." };

  let lastError = "Não foi possível atualizar o catálogo agora.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await withTimeout(loadCatalog(query), CATALOG_REQUEST_TIMEOUT_MS);
      if (result.source === "supabase" || !result.error) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
    if (attempt === 0) await wait(CATALOG_RETRY_DELAY_MS);
  }

  return { ...local, source: "local", error: `${lastError} Exibindo a base local disponível.` };
}

export function fetchCatalog(
  query = "",
  options: { force?: boolean } = {},
): Promise<CatalogResult> {
  const canReuse = !query && !options.force;

  if (canReuse && cachedCatalog && cachedCatalog.expiresAt > Date.now()) {
    return Promise.resolve(cachedCatalog.value);
  }
  if (canReuse && pendingCatalog) return pendingCatalog;

  const request = loadCatalogResilient(query);
  if (!query) {
    pendingCatalog = request;
    request.then(value => {
      cachedCatalog = { value, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
    }).finally(() => {
      if (pendingCatalog === request) pendingCatalog = null;
    });
  }
  return request;
}
