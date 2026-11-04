const LABELS: Record<string, string> = {
  limpeza: "Limpeza",
  higiene: "Higiene",
  mercearia: "Mercearia",
  laticinios: "Laticínios",
  cabelo: "Cabelo",
  condimentos: "Condimentos",
  biscoitos: "Biscoitos",
  "bebidas em po": "Bebidas em pó",
  bebidas: "Bebidas",
  outros: "Outros",
};

export function formatCategoryLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return "";
  const key = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (LABELS[key]) return LABELS[key];
  return raw
    .split(" ")
    .map(word => word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1))
    .join(" ");
}
