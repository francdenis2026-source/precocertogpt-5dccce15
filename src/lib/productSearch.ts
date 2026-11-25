import type { Product, ProductOffer } from "../data/catalog";
import { parseMeasure } from "./pricing";

export const normalizeSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

// Termos curtos que já formam uma palavra completa não devem funcionar como
// prefixo de outro produto. Assim, "sal" encontra "Sal Refinado", mas não
// "salgadinho", "salsicha" ou "salame".
const exactWordSearchTerms = new Set(["sal"]);

function tokenMatchesText(token: string, text: string) {
  if (!exactWordSearchTerms.has(token)) return text.includes(token);
  return text.split(" ").includes(token);
}

function tokenMatchesWord(token: string, word: string) {
  return exactWordSearchTerms.has(token) ? word === token : word === token || word.startsWith(token);
}

type ProductFamilyId = "achocolatado" | "amido-de-milho" | "lava-roupas-em-po" | "macarrao-instantaneo";
type SearchFamily = { id: ProductFamilyId; pattern: RegExp };

// Sinônimos comerciais seguros. A lista é restrita para não transformar
// produtos apenas relacionados (chocolate em pó, por exemplo) em equivalentes.
const searchFamilies: SearchFamily[] = [
  { id: "achocolatado", pattern: /\b(?:achocolatad[oa]s?(?:\s+em\s+po)?|nescau|toddy|chocolatto)\b/g },
  { id: "amido-de-milho", pattern: /\b(?:maizena|amido\s+de\s+milho)\b/g },
  { id: "lava-roupas-em-po", pattern: /\b(?:sabao\s+em\s+po|lava\s+roupas\s+em\s+po)\b/g },
  { id: "macarrao-instantaneo", pattern: /\b(?:miojo|lamen|macarrao\s+instantaneo)\b/g },
];

function familyInText(value: string) {
  const normalized = normalizeSearchText(value);
  return searchFamilies.find(family => {
    family.pattern.lastIndex = 0;
    return family.pattern.test(normalized);
  });
}

function queryFamily(value: string) {
  const normalized = normalizeSearchText(value);
  const family = familyInText(normalized);
  if (!family) return null;
  family.pattern.lastIndex = 0;
  const remainder = normalized.replace(family.pattern, " ").replace(/\s+/g, " ").trim();
  return { family: family.id, remainderTokens: remainder.split(" ").filter(Boolean) };
}

function recognizedFamilyFromName(name: string) {
  return familyInText(name)?.id ?? "";
}

export function productSearchScore(product: Product, query: string) {
  const q = normalizeSearchText(query);
  if (!q) return 1;
  const name = normalizeSearchText(product.name);
  const brand = normalizeSearchText(product.brand);
  const category = normalizeSearchText(product.category);
  const barcode = normalizeSearchText(product.barcode ?? "");
  const all = normalizeSearchText([product.name, product.brand, product.category, product.size, product.unit, product.barcode].filter(Boolean).join(" "));
  const tokens = q.split(" ").filter(Boolean);
  // Para "sal", somente o nome do produto pode validar a intenção. Isso
  // impede que um campo secundário inconsistente faça "Salgadinho" entrar.
  if (tokens.includes("sal") && !name.split(" ").includes("sal")) return 0;
  const directMatch = tokens.every(token => tokenMatchesText(token, all));
  const alias = queryFamily(q);
  const aliasMatch = Boolean(alias && recognizedFamilyFromName(product.name) === alias.family && alias.remainderTokens.every(token => tokenMatchesText(token, all)));
  if (!directMatch && !aliasMatch) return 0;
  let score = 20;
  if (aliasMatch) score += 55;
  if (name === q) score += 120;
  else if (name.startsWith(q)) score += 90;
  else if (name.includes(q)) score += 70;
  if (brand === q || brand.startsWith(q)) score += 35;
  if (category === q) score += 20;
  if (barcode === q) score += 140;
  score += tokens.filter(token => tokenMatchesText(token, name)).length * 12;
  score += tokens.filter(token => tokenMatchesText(token, brand)).length * 5;
  return score;
}

export function searchProducts(products: Product[], query: string) {
  const q = normalizeSearchText(query);
  if (!q) return [...products];
  return products.map(product => ({ product, score: productSearchScore(product, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.minPrice - b.product.minPrice || a.product.name.localeCompare(b.product.name, "pt-BR"))
    .map(item => item.product);
}

/**
 * Sugestões enquanto o usuário digita. Aceita prefixos de palavras ("arr" →
 * "arroz"), mas não aproxima palavras apenas parecidas. Ofertas repetidas em
 * lojas diferentes são consolidadas, mantendo a de menor preço na prévia.
 */
export function suggestProducts(products: Product[], query: string, limit = 6) {
  const q = normalizeSearchText(query);
  if (!q) return [...products].sort((a, b) => a.minPrice - b.minPrice).slice(0, limit);

  const queryTokens = q.split(" ").filter(Boolean);
  const alias = queryFamily(q);
  const matches = products.filter(product => {
    // Adicionais (recheios, acréscimos de lanche) não são produtos de compra: não aparecem na busca.
    if (normalizeSearchText(product.category || "") === "adicionais") return false;
    const nameWords = normalizeSearchText(product.name).split(" ");
    const directMatch = queryTokens.every(token => nameWords.some(word => tokenMatchesWord(token, word)));
    const aliasMatch = Boolean(alias && recognizedFamilyFromName(product.name) === alias.family && alias.remainderTokens.every(token => nameWords.some(word => tokenMatchesWord(token, word))));
    // Categoria (ex.: "açougue", "padaria") também conta, para o cliente achar a seção inteira.
    return directMatch || aliasMatch || productSearchScore(product, q) > 0;
  });

  const unique = new Map<string, Product>();
  for (const product of matches.sort((a, b) => productSearchScore(b, q) - productSearchScore(a, q) || a.minPrice - b.minPrice)) {
    const key = normalizeSearchText([product.name, product.brand, product.size].join("|"));
    const saved = unique.get(key);
    if (!saved || product.minPrice < saved.minPrice) unique.set(key, product);
  }
  return [...unique.values()].slice(0, limit);
}

const similarityNoise = new Set([
  "a", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "o", "os",
  "para", "por", "sem", "tipo", "tradicional", "classico", "classica", "sabor",
  "pacote", "garrafa", "frasco", "caixa", "lata", "pote", "sache", "unidade",
  "unidades", "kg", "g", "mg", "l", "ml",
]);

function productFamilyTokens(product: Product) {
  const brandTokens = new Set(normalizeSearchText(product.brand || "").split(" ").filter(Boolean));
  return [...new Set(normalizeSearchText(product.name).split(" ").filter(token =>
    token.length >= 3 &&
    !/^\d+$/.test(token) &&
    !similarityNoise.has(token) &&
    !brandTokens.has(token),
  ))];
}

function productMeasure(product: Product) {
  // Alguns cadastros antigos guardam a gramagem no nome e deixam `size`
  // vazio. Considerar os dois campos evita perder comparações válidas.
  return parseMeasure(`${product.name} ${product.size || ""}`, product.unit);
}

// Famílias compostas não podem ser reduzidas ao termo genérico "leite".
// Sem esta distinção, leite em pó 400 g era comparado com doce de leite,
// creme de leite e leite condensado apenas porque tinham peso semelhante.
function recognizedProductFamily(product: Product) {
  const name = normalizeSearchText(product.name);
  const commercialFamily = recognizedFamilyFromName(name);
  if (commercialFamily) return commercialFamily;
  if (/\bleite\s+(?:em\s+)?po\b/.test(name)) return "leite-em-po";
  if (/\bleite\s+condensado\b/.test(name)) return "leite-condensado";
  if (/\bcreme\s+de\s+leite\b/.test(name)) return "creme-de-leite";
  if (/\bdoce\s+(?:de\s+soro\s+)?de\s+leite\b/.test(name)) return "doce-de-leite";
  if (/\bleite\s+de\s+coco\b/.test(name)) return "leite-de-coco";
  return "";
}

function hasSameProductFamily(reference: Product, candidate: Product) {
  const recognizedReference = recognizedProductFamily(reference);
  const recognizedCandidate = recognizedProductFamily(candidate);
  if (recognizedReference || recognizedCandidate) {
    return Boolean(recognizedReference && recognizedReference === recognizedCandidate);
  }
  const referenceTokens = productFamilyTokens(reference);
  const candidateTokens = productFamilyTokens(candidate);
  const shared = referenceTokens.filter(token => candidateTokens.includes(token));
  return Boolean(shared.length && (
    referenceTokens[0] === candidateTokens[0] || shared.length >= 2
  ));
}

/**
 * Equivalência comercial: marca não participa da decisão. Exigimos a mesma
 * família de produto, a mesma dimensão (peso, volume ou unidade) e embalagem
 * com quantidade praticamente igual. A tolerância absorve apenas variações de
 * cadastro/arredondamento; 900 ml não vira concorrente de 1 L.
 */
export function isEquivalentProduct(reference: Product, candidate: Product) {
  if (String(reference.id) === String(candidate.id)) return true;
  const referenceCategory = normalizeSearchText(reference.category || "");
  const candidateCategory = normalizeSearchText(candidate.category || "");
  const referenceFamily = recognizedProductFamily(reference);
  const candidateFamily = recognizedProductFamily(candidate);
  if (referenceCategory && candidateCategory && referenceCategory !== candidateCategory && !(referenceFamily && referenceFamily === candidateFamily)) return false;
  if (!hasSameProductFamily(reference, candidate)) return false;

  const referenceMeasure = productMeasure(reference);
  const candidateMeasure = productMeasure(candidate);
  if (!referenceMeasure || !candidateMeasure || referenceMeasure.base !== candidateMeasure.base) return false;
  const tolerance = Math.max(referenceMeasure.quantity, candidateMeasure.quantity) * 0.05;
  return Math.abs(referenceMeasure.quantity - candidateMeasure.quantity) <= tolerance;
}

export type ComparableOffer = ProductOffer & {
  productId: string | number;
  productSlug: string;
  productName: string;
  productBrand: string;
  productSize: string;
  exactProduct: boolean;
};

function offersFor(product: Product): ProductOffer[] {
  return product.offers?.length ? product.offers : [{
    establishmentId: product.establishmentId,
    establishmentSlug: product.establishmentSlug,
    establishment: product.establishment,
    neighborhood: product.neighborhood,
    storeColor: product.storeColor,
    value: product.minPrice,
    capturedAt: product.capturedAt,
    previousPrice: product.previousPrice,
  }];
}

/** Ranking por estabelecimento para o produto exato e equivalentes de outra marca. */
export function buildComparableOffers(products: Product[], reference: Product): ComparableOffer[] {
  const byStore = new Map<string, ComparableOffer>();
  for (const product of products.filter(candidate => isEquivalentProduct(reference, candidate))) {
    for (const offer of offersFor(product)) {
      if (!Number.isFinite(offer.value) || offer.value <= 0) continue;
      const enriched: ComparableOffer = {
        ...offer,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productBrand: product.brand,
        productSize: product.size || product.unit,
        exactProduct: String(product.id) === String(reference.id),
      };
      const key = String(offer.establishmentId || normalizeSearchText(offer.establishment));
      const saved = byStore.get(key);
      if (!saved || enriched.value < saved.value || (enriched.value === saved.value && enriched.exactProduct && !saved.exactProduct)) {
        byStore.set(key, enriched);
      }
    }
  }
  return [...byStore.values()].sort((a, b) => a.value - b.value || a.establishment.localeCompare(b.establishment, "pt-BR"));
}

function similarityScore(reference: Product, candidate: Product) {
  if (String(reference.id) === String(candidate.id)) return 0;

  const referenceCategory = normalizeSearchText(reference.category || "");
  const candidateCategory = normalizeSearchText(candidate.category || "");
  const referenceFamily = recognizedProductFamily(reference);
  const candidateFamily = recognizedProductFamily(candidate);
  if (referenceCategory && candidateCategory && referenceCategory !== candidateCategory && !(referenceFamily && referenceFamily === candidateFamily)) return 0;

  const referenceTokens = productFamilyTokens(reference);
  const candidateTokens = productFamilyTokens(candidate);
  const shared = referenceTokens.filter(token => candidateTokens.includes(token));

  // Categoria isolada nunca define similaridade: "Mercearia", por exemplo,
  // pode conter arroz, feijão, óleo e biscoito. É obrigatório compartilhar ao
  // menos um termo real da família/natureza do produto.
  const sameRecognizedFamily = Boolean(referenceFamily && referenceFamily === candidateFamily);
  if (!shared.length && !sameRecognizedFamily) return 0;

  const referenceIdentity = normalizeSearchText([reference.name, reference.brand, reference.size].join(" "));
  const candidateIdentity = normalizeSearchText([candidate.name, candidate.brand, candidate.size].join(" "));
  if (referenceIdentity === candidateIdentity) return 0;

  const union = new Set([...referenceTokens, ...candidateTokens]).size || 1;
  let score = shared.length * 100 + (shared.length / union) * 60;
  if (sameRecognizedFamily) score += 180;
  if (referenceTokens[0] && referenceTokens[0] === candidateTokens[0]) score += 45;
  if (normalizeSearchText(reference.brand || "") === normalizeSearchText(candidate.brand || "")) score += 15;
  if (normalizeSearchText(reference.unit || "") === normalizeSearchText(candidate.unit || "")) score += 5;
  return score;
}

export function findComparableProducts(products: Product[], reference: Product, limit = 4) {
  return products
    .filter(product => String(product.id) !== String(reference.id) && isEquivalentProduct(reference, product))
    .sort((a, b) => a.minPrice - b.minPrice || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
}

/**
 * Retorna somente alternativas com relação lexical real com o produto.
 * Quando não há uma família compatível no catálogo, devolve uma lista vazia
 * em vez de preencher o espaço com itens aleatórios da mesma categoria.
 */
export function findSimilarProducts(products: Product[], reference: Product, limit = 4) {
  return products
    .map(product => ({ product, score: similarityScore(reference, product) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.minPrice - b.product.minPrice || a.product.name.localeCompare(b.product.name, "pt-BR"))
    .slice(0, limit)
    .map(item => item.product);
}
