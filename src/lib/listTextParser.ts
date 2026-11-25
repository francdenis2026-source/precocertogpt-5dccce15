import type { Product } from "../data/catalog";
import { suggestProducts } from "./productSearch";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };
const UNIT = /^(kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?|pct|pacotes?|cx|caixas?|latas?|garrafas?)\b\s*/;

// Apelidos comuns que o cliente escreve e o termo usado no catálogo.
// Mantenha esta tabela pequena e revisada; o que não estiver aqui usa o próprio texto.
const SYNONYMS: Record<string, string> = {
  "cafezinho": "cafe",
  "po de cafe": "cafe",
  "pao frances": "pao frances",
  "paozinho": "pao",
  "galinha": "frango",
  "frango inteiro": "frango",
  "ovo": "ovos",
  "carne bovina": "carne",
  "leite de caixa": "leite",
  "refri": "refrigerante",
  "bolacha": "biscoito",
  "biscoitos": "biscoito",
};

export type ParsedLine = { raw: string; quantity: number; term: string };

/** Quebra o texto em itens: uma linha ou vírgula por item, com quantidade opcional. */
export function parseListText(text: string): ParsedLine[] {
  return text
    .split(/[\n;]+|(?<!\d),|,(?!\d)/)
    .map(raw => raw.trim())
    .filter(Boolean)
    .map(raw => {
      let rest = normalize(raw.replace(/(\d),(\d)/g, "$1p$2"));
      let quantity = 1;
      const num = rest.match(/^(\d+(?:p\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis)\s*x?\s*/);
      if (num) {
        const token = num[1];
        quantity = NUMBER_WORDS[token] ?? Number(token.replace("p", "."));
        rest = rest.slice(num[0].length);
      }
      rest = rest.replace(UNIT, "").replace(/^(de|do|da|dos|das)\s+/, "").trim();
      const alias = Object.keys(SYNONYMS).find(key => rest === key || rest.startsWith(`${key} `));
      const term = alias ? SYNONYMS[alias] + rest.slice(alias.length) : rest;
      return { raw, quantity: quantity > 0 && Number.isFinite(quantity) ? quantity : 1, term: term.trim() };
    })
    .filter(line => line.term.length > 0);
}

export type MatchedLine = ParsedLine & { product: Product | null; price: number | null };

/** Acha, para cada item, o produto de melhor correspondência no catálogo (o mais barato entre os empatados). */
export function matchListLines(lines: ParsedLine[], catalog: Product[]): MatchedLine[] {
  return lines.map(line => {
    const [best] = suggestProducts(catalog, line.term, 1);
    return { ...line, product: best ?? null, price: best ? best.minPrice : null };
  });
}
