// Catálogo PreçoCerto — tipos e fallback sem dados fictícios.
// Em produção, estabelecimentos e preços vêm do Supabase. Quando o banco estiver
// indisponível, o app não deve inventar lojas/produtos demo.

import { withManualAdditions } from "./manualEstablishments";

export type PricePromo = {
  label: string;
  until: string;
  regularPrice?: number;
};

export type ProductOffer = {
  establishmentId: string | number;
  establishmentSlug: string;
  establishment: string;
  neighborhood: string;
  storeColor: string;
  value: number;
  capturedAt: string;
  previousPrice?: number;
  promo?: PricePromo;
};

export type Product = {
  id: string | number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  unit: string;
  barcode?: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  storeCount: number;
  establishmentId: string | number;
  establishmentSlug: string;
  establishment: string;
  neighborhood: string;
  storeColor: string;
  capturedAt: string;
  previousPrice?: number;
  promo?: PricePromo;
  image_url?: string;
  source?: string;
  updated_at?: string;
  price_history?: { date: string; value: number }[];
  offers?: ProductOffer[];
};

export type StoreRow = {
  id: string | number;
  slug: string;
  name: string;
  neighborhood: string;
  color: string;
  products: number;
  kind?: string;
  address?: string;
  logoUrl?: string;
  city?: string;
  openingHours?: string;
  photoUrl?: string;
  whatsapp?: string;
};

export type PlatformMetrics = { products: number; prices: number; stores: number };
export type CatalogPayload = {
  products: Product[];
  stores: StoreRow[];
  metrics: PlatformMetrics;
  updatedAt: string;
};

// Mantidos por compatibilidade com módulos antigos, mas sem contagens/linhas demo.
export const verifiedDatasetMetrics: PlatformMetrics = { products: 0, prices: 0, stores: 0 };
export const establishmentSeed: [] = [];
export const productSeed: [] = [];
export const priceSeed: [] = [];

function buildEmptyCatalog(): CatalogPayload {
  return {
    products: [],
    stores: [],
    metrics: { products: 0, prices: 0, stores: 0 },
    updatedAt: new Date().toISOString(),
  };
}

export function buildCatalog(query = ""): CatalogPayload {
  // As adições manuais representam negócios reais cadastrados com dados oficiais;
  // nenhum estabelecimento fictício/demo é criado aqui.
  return withManualAdditions(buildEmptyCatalog(), query);
}
