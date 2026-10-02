import {
  ArrowRight,
  Beef,
  BookOpen,
  Croissant,
  LayoutGrid,
  Pill,
  Sandwich,
  ShoppingCart,
  Wrench,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { businessGroups, groupForStore, type BusinessGroupId } from "../../data/businessTaxonomy";
import type { StoreRow } from "../../data/catalog";
import bakeryImage from "../../assets/sectors-2026/sector-bakery-v3.jpg";
import booksImage from "../../assets/sectors-2026/sector-books-v3.jpg";
import butchersImage from "../../assets/sectors-2026/sector-butchers-v3.jpg";
import foodImage from "../../assets/sectors-2026/sector-food-v3.jpg";
import marketsImage from "../../assets/sectors-2026/sector-markets-v3.jpg";
import pharmaciesImage from "../../assets/sectors-2026/sector-pharmacies-v3.jpg";
import servicesImage from "../../assets/sectors-2026/sector-services-v3.jpg";
import otherImage from "../../assets/home-2026/promo-setores-organizados.jpg";
import heroImage from "../../assets/home-2026/comercio-local-atendimento.jpg";
import { SectionHeader } from "./SectionHeader";
import "./CategoryTiles.css";

const intBr = new Intl.NumberFormat("pt-BR");

/* Ícones e subtítulos por grupo — os grupos em si (nomes, rotas, quais tipos
 * de negócio cada um reúne) vêm de businessTaxonomy.ts, a mesma fonte usada
 * pelas rotas /mercados, /acougues etc. em App.tsx. Nada aqui é inventado:
 * é só a camada visual (ícone Lucide + subtítulo curto) sobre grupos reais. */
const CATEGORY_ICON: Record<BusinessGroupId, LucideIcon> = {
  markets: ShoppingCart,
  butchers: Beef,
  bakery: Croissant,
  food: Sandwich,
  pharmacies: Pill,
  books: BookOpen,
  services: Wrench,
  other: Tag,
};

const CATEGORY_SUB: Record<BusinessGroupId, string> = {
  markets: "Compare preços",
  butchers: "Carnes e cortes",
  bakery: "Pães e confeitaria",
  food: "Lanches e refeições",
  pharmacies: "Medicamentos",
  books: "Livros e cultura",
  services: "Profissionais locais",
  other: "Outros comércios",
};

/* Fundo pastel por categoria (como no pacote de referência visual: cada
 * categoria com uma cor sutil própria, não tudo verde). Só o chip do ícone
 * muda — o card continua branco. */
const CATEGORY_TINT: Record<BusinessGroupId, string> = {
  markets: "pcx-category--green",
  butchers: "pcx-category--red",
  bakery: "pcx-category--amber",
  food: "pcx-category--orange",
  pharmacies: "pcx-category--blue",
  books: "pcx-category--violet",
  services: "pcx-category--slate",
  other: "pcx-category--pink",
};

const CATEGORY_IMAGE: Record<BusinessGroupId, string> = {
  markets: marketsImage,
  butchers: butchersImage,
  bakery: bakeryImage,
  food: foodImage,
  pharmacies: pharmaciesImage,
  books: booksImage,
  services: servicesImage,
  other: otherImage,
};

export function CategoryBar({ stores = [] }: { stores?: StoreRow[] }) {
  
  // Soma real de produtos por grupo, a partir da contagem que cada loja já
  // carrega (StoreRow.products) — nenhum número inventado; some 0 vira só o
  // subtítulo genérico de CATEGORY_SUB (ex.: durante o carregamento).
  const productCountByGroup = useMemo(() => {
    const totals = new Map<BusinessGroupId, number>();
    for (const store of stores) {
      if (!store.products) continue;
      const groupId = groupForStore(store).id;
      totals.set(groupId, (totals.get(groupId) || 0) + store.products);
    }
    return totals;
  }, [stores]);

  return (
    <section className="pcx-section pcx-section--muted" aria-labelledby="categories-title">
      <div className="pcx-shell">
        <SectionHeader
          id="categories-title"
          title="Explore por categoria"
          description="Entre direto no tipo de compra que você precisa."
          linkTo="/explorar"
          linkLabel="Ver todas"
          linkIcon={<LayoutGrid aria-hidden="true" />}
        />
        <div className="pcx-bento" aria-label="Categorias de estabelecimentos">
          <Link className="pcx-tile pcx-tile--hero pcx-tile--green" to="/explorar">
            <img src={heroImage} alt="" aria-hidden="true" loading="lazy" decoding="async" width="1280" height="720" />
            <span className="pcx-tile__glass">
              <span className="pcx-tile__text">
                <strong>Comércio de Feijó, tudo num só lugar</strong>
                <span>Escolha um tipo de loja para começar</span>
              </span>
              <ArrowRight className="pcx-tile__go" aria-hidden="true" />
            </span>
          </Link>
          {businessGroups.map((group) => {
            const Icon = CATEGORY_ICON[group.id];
            const productCount = productCountByGroup.get(group.id);
            return (
              <Link className={`pcx-tile ${CATEGORY_TINT[group.id].replace("pcx-category--", "pcx-tile--")}`} key={group.id} to={group.href}>
                <img src={CATEGORY_IMAGE[group.id]} alt="" aria-hidden="true" loading="lazy" decoding="async" width="1280" height="720" />
                <span className="pcx-tile__glass">
                  <i className="pcx-tile__chip"><Icon aria-hidden="true" /></i>
                  <span className="pcx-tile__text">
                    <strong>{group.shortLabel}</strong>
                    <span>{productCount ? `${intBr.format(productCount)} produtos` : CATEGORY_SUB[group.id]}</span>
                  </span>
                  <ArrowRight className="pcx-tile__go" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
