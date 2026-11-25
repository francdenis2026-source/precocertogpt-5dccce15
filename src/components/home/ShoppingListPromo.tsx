import { Link } from "react-router-dom";
import { ArrowRight, ListChecks } from "lucide-react";

export function ShoppingListPromo({ guest }: { guest: boolean }) {
  return (
    <section className="ph-wrap ph-list-promo" aria-labelledby="ph-list-promo-title">
      <div className="ph-list-promo__copy">
        <ListChecks aria-hidden="true" />
        <div>
          <h2 id="ph-list-promo-title">Monte sua lista de compras e veja onde ela custa menos</h2>
          <p>
            Digite os produtos, filtre por estabelecimento ou categoria e veja o total da cesta em cada loja.
            {guest ? " A ferramenta é gratuita para quem tem cadastro na plataforma." : ""}
          </p>
        </div>
      </div>
      {guest ? (
        <Link className="ph-btn ph-btn--primary" to="/cadastro">Criar conta grátis <ArrowRight aria-hidden="true" /></Link>
      ) : (
        <Link className="ph-btn ph-btn--primary" to="/minhas-listas">Abrir minhas listas <ArrowRight aria-hidden="true" /></Link>
      )}
    </section>
  );
}
