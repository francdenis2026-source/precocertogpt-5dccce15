import { supabase } from "./supabase";

const SESSION_KEY = "precocerto:analytics-session";

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

const PRIVATE_PREFIXES = ["/admin", "/painel-lojista", "/lojista"];

/** Registra a abertura de uma página pública do site (contador de visitas). */
export function trackPageView(path: string) {
  if (!supabase || !path) return;
  if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  let referrer: string | null = null;
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) {
      referrer = document.referrer.slice(0, 300);
    }
  } catch {
    referrer = null;
  }
  void supabase.from("page_views").insert({
    path: path.slice(0, 300),
    referrer,
    session_id: getSessionId(),
  });
}

/** Registra a visualização de um produto (cliente cadastrado ou não). */
export function trackProductView(productId: string) {
  if (!supabase || !productId) return;
  void supabase.from("product_events").insert({
    event_type: "view",
    product_id: String(productId),
    session_id: getSessionId(),
  });
}

/** Registra um termo de busca real (já debounced pelo chamador). */
export function trackSearch(query: string) {
  const trimmed = query.trim();
  if (!supabase || trimmed.length < 2) return;
  void supabase.from("product_events").insert({
    event_type: "search",
    query: trimmed,
    session_id: getSessionId(),
  });
}

export type TopProductRow = { product_id: string; views: number };
export type TopSearchRow = { query: string; searches: number };

/** Produtos mais visualizados na plataforma nos últimos `days` dias. */
export async function fetchTopProducts(days = 30, resultLimit = 10): Promise<TopProductRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_top_products", { days, result_limit: resultLimit });
  if (error || !data) return [];
  return data as TopProductRow[];
}

/** Termos mais buscados na plataforma nos últimos `days` dias. */
export async function fetchTopSearches(days = 30, resultLimit = 10): Promise<TopSearchRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_top_searches", { days, result_limit: resultLimit });
  if (error || !data) return [];
  return data as TopSearchRow[];
}
