// Estabelecimentos cadastrados manualmente — cobre negócios reais que ainda não
// têm um cadastro próprio no banco (Supabase) desta sessão, mas que já devem
// aparecer em produção: diretório de estabelecimentos, busca, cesta e página
// própria do comércio. Some daqui quando o negócio ganhar cadastro oficial no
// painel do lojista, para não duplicar o registro.
//
// Primeiro negócio: Kelly Burguearia e Lanchonete (Feijó-AC), cardápio enviado
// pela proprietária em 22/08/2026 — dados a seguir são o cardápio oficial.

import type { CatalogPayload, Product, ProductOffer, StoreRow } from "./catalog";
import { SANDUBA_ID, SANDUBA_NAME, sandubaProducts, sandubaStores } from "./manualEstablishments2";
// item-hamburguer-2.jpg (composição malfeita, chamas e pétalas coladas sobre
// o sanduíche) foi removida do projeto. sector-food-v3.jpg é uma foto real de
// preparo de hambúrguer já usada como imagem de setor "lanchonete" em outras
// partes do site — sem essa criação artificial.
import kellyBurgerPhoto from "../assets/sectors-2026/sector-food-v3.jpg";

export const KELLY_ID = "kelly-burgueria-lanchonete";
export const KELLY_NAME = "Kelly Burgueria e Lanchonete";
export const KELLY_NEIGHBORHOOD = "Bela Vista";
export const KELLY_COLOR = "#e7b400";
export const KELLY_ADDRESS = "Rua José Leopoldino Guimarães, 150 - Bela Vista, Feijó - AC, 69.960-000 (cruzamento da Escola Casulo)";
export const KELLY_CNPJ = "42.755.163/0001-24";
export const KELLY_PHONE = "(68) 99939-5494";
export const KELLY_WHATSAPP = "5568999395494";
export const KELLY_INSTAGRAM = "https://instagram.com/kellyburgueria";

export type MenuItem = { name: string; category: string; price: number; description?: string };

export const KELLY_MENU_CATEGORIES = [
  "Hambúrgueres",
  "Carne na Chapa",
  "Lanches Rápidos",
  "Panquecas",
  "Monte sua Batata",
  "Adicionais",
  "Bebidas",
  "Suco Natural",
] as const;

export const KELLY_MENU: MenuItem[] = [
  // Hambúrgueres
  { name: "Guloso", category: "Hambúrgueres", price: 30, description: "Hambúrguer duplo, molho barbecue, ovo duplo, frango, molho cheddar, calabresa, bacon, cebola, banana frita, queijo, presunto, alface, tomate e milho." },
  { name: "Triplo X Burguer", category: "Hambúrgueres", price: 30, description: "3 hambúrgueres, 2 ovos, bacon, queijo, cheddar, alface e tomate." },
  { name: "Super Apimentado", category: "Hambúrgueres", price: 26, description: "Hambúrguer duplo, queijo, presunto, ovos, bacon, banana frita, cebola, tomate, alface e pasta cremosa apimentada." },
  { name: "Tudão", category: "Hambúrgueres", price: 26, description: "Hambúrguer, molho barbecue, frango, cheddar, salsicha, calabresa, bacon, cebola, ovo, banana frita, queijo, presunto, alface, tomate e milho." },
  { name: "Beef Burg", category: "Hambúrgueres", price: 26, description: "Tiras de filé bovino, molho barbecue, cebola, molho apimentado, alface e tomate." },
  { name: "Catupiry", category: "Hambúrgueres", price: 25, description: "Alface, tomate, frango desfiado, presunto, catupiry, queijo, bacon, calabresa e banana da terra." },
  { name: "Picante", category: "Hambúrgueres", price: 23, description: "Hambúrguer, bacon, queijo, presunto, banana comprida, molho cremoso, apimentado e alface." },
  { name: "Fran-Burguer", category: "Hambúrgueres", price: 22, description: "Hambúrguer, frango desfiado, presunto, cebola caramelizada, catupiry, queijo, alface e tomate." },
  { name: "Tudo", category: "Hambúrgueres", price: 22, description: "Hambúrguer, molho barbecue, salsicha, calabresa, ovo, queijo, presunto, alface, tomate e milho." },
  { name: "Bacon-Burguer", category: "Hambúrgueres", price: 20, description: "Hambúrguer, bacon, queijo, presunto, alface, tomate e milho." },
  { name: "Frango", category: "Hambúrgueres", price: 20, description: "Frango, cheddar, batata palha, queijo, presunto, alface, tomate e milho." },
  { name: "Salada Especial", category: "Hambúrgueres", price: 15, description: "Hambúrguer, banana curta caramelizada, queijo, presunto e salada." },
  { name: "Cala-Burguer", category: "Hambúrgueres", price: 15, description: "Hambúrguer, calabresa, queijo, presunto e salada." },
  { name: "Salada", category: "Hambúrgueres", price: 14, description: "Hambúrguer, queijo, presunto e salada." },
  { name: "Burguer", category: "Hambúrgueres", price: 10, description: "Hambúrguer, queijo e presunto." },

  // Carne na Chapa
  { name: "Picanha", category: "Carne na Chapa", price: 40, description: "Na chapa. Acompanhamento a consultar no ato do pedido." },
  { name: "Filé de Boi", category: "Carne na Chapa", price: 40, description: "Na chapa. Acompanhamento a consultar no ato do pedido." },
  { name: "Tiras de Alcatra", category: "Carne na Chapa", price: 38, description: "Na chapa. Acompanhamento a consultar no ato do pedido." },
  { name: "Filé de Frango", category: "Carne na Chapa", price: 35, description: "Na chapa. Acompanhamento a consultar no ato do pedido." },

  // Lanches Rápidos
  { name: "Dogg", category: "Lanches Rápidos", price: 10, description: "Salsicha, batata palha, queijo, presunto e salada." },
  { name: "Americano", category: "Lanches Rápidos", price: 10, description: "Ovo, queijo, presunto e salada." },
  { name: "Misto-Quente", category: "Lanches Rápidos", price: 10, description: "Queijo e presunto." },

  // Panquecas
  { name: "Panqueca de Frango c/ Catupiry e Cheddar", category: "Panquecas", price: 12 },
  { name: "Panqueca de Carne c/ Catupiry e Cheddar", category: "Panquecas", price: 12 },
  { name: "Panqueca de Frango ou Carne c/ Queijo e Banana", category: "Panquecas", price: 12 },
  { name: "Galinha Picante c/ Molho de Panqueca", category: "Panquecas", price: 10 },
  { name: "Panqueca de Frango ou Carne com Catupiry", category: "Panquecas", price: 10 },
  { name: "Panqueca de Frango ou Carne com Cheddar", category: "Panquecas", price: 10 },
  { name: "Panqueca de Carne", category: "Panquecas", price: 8 },
  { name: "Panqueca de Frango", category: "Panquecas", price: 8 },
  { name: "Galinha Picante", category: "Panquecas", price: 8 },

  // Monte sua Batata
  { name: "Fritas Tradicionais 300g", category: "Monte sua Batata", price: 22 },
  { name: "Fritas Tradicionais 100g", category: "Monte sua Batata", price: 12 },

  // Adicionais
  { name: "Bacon (adicional)", category: "Adicionais", price: 8 },
  { name: "Calabresa (adicional)", category: "Adicionais", price: 6 },
  { name: "Cheddar (adicional)", category: "Adicionais", price: 5 },
  { name: "Molho Rosê (adicional)", category: "Adicionais", price: 3 },
  { name: "Maionese (adicional)", category: "Adicionais", price: 2 },

  // Bebidas
  { name: "Coca-Cola 2L", category: "Bebidas", price: 15 },
  { name: "Fanta Laranja 2L", category: "Bebidas", price: 15 },
  { name: "Fanta Uva 2L", category: "Bebidas", price: 15 },
  { name: "Coca-Cola Zero 2L", category: "Bebidas", price: 15 },
  { name: "Coca-Cola 1,5L", category: "Bebidas", price: 13 },
  { name: "Fanta Laranja 1,5L", category: "Bebidas", price: 12 },
  { name: "Tuchaua 2L", category: "Bebidas", price: 12 },
  { name: "Fanta Laranja 1L", category: "Bebidas", price: 12 },
  { name: "Coca-Cola 1L", category: "Bebidas", price: 12 },
  { name: "Coca-Cola 600ml", category: "Bebidas", price: 10 },
  { name: "Fanta Laranja Lata", category: "Bebidas", price: 6 },
  { name: "Fanta Uva Lata", category: "Bebidas", price: 6 },
  { name: "Tuchaua Lata", category: "Bebidas", price: 6 },
  { name: "Coca-Cola Lata", category: "Bebidas", price: 6 },
  { name: "Coca-Cola KS 290ml", category: "Bebidas", price: 5 },
  { name: "Água com Gás", category: "Bebidas", price: 4 },
  { name: "Água Mineral", category: "Bebidas", price: 3 },

  // Suco Natural
  { name: "Suco de Maracujá 300ml", category: "Suco Natural", price: 10 },
  { name: "Adicional de Leite", category: "Suco Natural", price: 2 },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const CAPTURED_AT = "2026-08-22T09:00:00-05:00";

export const manualStores: StoreRow[] = [
  { id: KELLY_ID, slug: KELLY_ID, name: KELLY_NAME, neighborhood: KELLY_NEIGHBORHOOD, color: KELLY_COLOR, products: KELLY_MENU.length, kind: "snack_bar" },
];

// Fotos reais recortadas do próprio cardápio enviado, aplicadas por
// categoria (não há foto individual de cada item — só algumas fotos de
// prato/produto no material recebido). "Hambúrgueres" alterna entre as duas
// fotos de burguer disponíveis para dar alguma variedade visual. Categorias
// sem entrada aqui (Adicionais) ficam sem foto: são só ingredientes extras,
// e não há nenhuma foto que os represente sem inventar uma.
const KELLY_CATEGORY_IMAGES: Partial<Record<string, string[]>> = {
  "Hambúrgueres": [kellyBurgerPhoto],
  "Carne na Chapa": ["/kelly-burgueria/carne-chapa.jpg"],
  "Lanches Rápidos": [kellyBurgerPhoto],
  "Panquecas": ["/kelly-burgueria/item-panqueca.jpg"],
  "Monte sua Batata": ["/kelly-burgueria/item-batata.jpg"],
  "Bebidas": ["/kelly-burgueria/item-bebida.jpg"],
  "Suco Natural": ["/kelly-burgueria/item-suco.jpg"],
};

const categoryImageCounters = new Map<string, number>();
function nextKellyImage(category: string): string | undefined {
  const options = KELLY_CATEGORY_IMAGES[category];
  if (!options || !options.length) return undefined;
  const index = categoryImageCounters.get(category) || 0;
  categoryImageCounters.set(category, index + 1);
  return options[index % options.length];
}

// Nome do item -> foto atribuída (mesma imagem usada no Product.image_url
// abaixo). A página do cardápio usa este mapa para mostrar a miniatura,
// garantindo que a mesma foto apareça tanto ali quanto em /buscar, /produto
// e no restante do site.
export const kellyItemImages = new Map<string, string>();

export const manualProducts: Product[] = KELLY_MENU.map((item) => {
  const image = nextKellyImage(item.category);
  if (image) kellyItemImages.set(item.name, image);
  const id = `kelly-${slugify(item.name)}`;
  const offer: ProductOffer = {
    establishmentId: KELLY_ID,
    establishmentSlug: KELLY_ID,
    establishment: KELLY_NAME,
    neighborhood: KELLY_NEIGHBORHOOD,
    storeColor: KELLY_COLOR,
    value: item.price,
    capturedAt: CAPTURED_AT,
  };
  return {
    id,
    slug: id,
    name: item.name,
    brand: "Kelly Burgueria",
    category: item.category,
    size: item.description || "Porção única",
    unit: "un",
    minPrice: item.price,
    avgPrice: item.price,
    maxPrice: item.price,
    storeCount: 1,
    establishmentId: KELLY_ID,
    establishmentSlug: KELLY_ID,
    establishment: KELLY_NAME,
    neighborhood: KELLY_NEIGHBORHOOD,
    storeColor: KELLY_COLOR,
    capturedAt: CAPTURED_AT,
    source: "Cardápio oficial (Kelly Burgueria e Lanchonete)",
    image_url: image,
    offers: [offer],
  } satisfies Product;
});

type ManualDataset = { id: string; name: string; stores: StoreRow[]; products: Product[] };

// Cada negócio cadastrado manualmente entra aqui. Adicionar um novo negócio =
// criar um arquivo manualEstablishmentsN.ts (mesmo formato deste) e somar uma
// entrada nesta lista — o resto (busca, diretório, cesta, métricas) já
// funciona automaticamente para todos.
// Cardápios Kelly e Beto Burguer já foram gravados em products/prices no banco.
// Lista mantida vazia para não somar os produtos duas vezes no contador.
const manualDatasets: ManualDataset[] = [];

/**
 * Mescla os cadastros manuais (acima) num CatalogPayload já resolvido, seja
 * ele vindo do Supabase ou do catálogo local de fallback. Aplica o mesmo
 * filtro de busca usado no restante do catálogo, para que esses negócios
 * apareçam normalmente em /buscar, na cesta e no diretório de estabelecimentos.
 */
export function withManualAdditions(payload: CatalogPayload, query = ""): CatalogPayload {
  const q = normalize(query);
  const matchesQuery = (product: Product) =>
    !q || [product.name, product.category, product.brand].some(field => normalize(field || "").includes(q));

  let stores = payload.stores;
  let products = payload.products;
  let addedStores = 0;
  let addedProducts = 0;

  // Kelly Burgueria e Beto Burguer já existem como estabelecimento cadastrado
  // de verdade no Supabase (aparecem em /estabelecimentos com endereço,
  // WhatsApp etc.) — só o cardápio deles é mantido aqui no código, não na
  // tabela de produtos. A checagem "alreadyPresent" original pulava a
  // mesclagem INTEIRA (loja E produtos) sempre que a loja já existia,
  // achando que estava evitando duplicata — na prática isso fazia o
  // cardápio inteiro nunca entrar no catálogo usado por /produto/:slug,
  // /buscar e a cesta: o link "Ver página completa do produto" sempre caía
  // em "Produto não encontrado", porque o produto nunca existia ali, só na
  // página dedicada da loja (que lê os arrays deste arquivo direto, sem
  // passar por este merge). Agora a loja duplicada continua sendo pulada,
  // mas o cardápio é mesclado de qualquer forma — indexado por produto
  // (não por loja), evitando duplicar entradas se esta função rodar mais
  // de uma vez sobre o mesmo payload.
  for (const dataset of manualDatasets) {
    const storeAlreadyPresent = stores.some(store => store.id === dataset.id || normalize(store.name) === normalize(dataset.name));
    if (!storeAlreadyPresent) {
      stores = [...stores, ...dataset.stores];
      addedStores += dataset.stores.length;
    }
    const existingProductIds = new Set(products.map(product => String(product.id)));
    const newProducts = dataset.products.filter(product => !existingProductIds.has(String(product.id))).filter(matchesQuery);
    if (newProducts.length) {
      products = [...products, ...newProducts];
      addedProducts += newProducts.length;
    }
  }

  if (!addedStores && !addedProducts) return payload;

  return {
    ...payload,
    products: products.sort((a, b) => a.minPrice - b.minPrice || a.name.localeCompare(b.name, "pt-BR")),
    stores,
    metrics: {
      products: payload.metrics.products + addedProducts,
      prices: payload.metrics.prices + addedProducts,
      stores: payload.metrics.stores + addedStores,
    },
  };
}
