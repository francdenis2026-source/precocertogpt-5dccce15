import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { Product } from "../../data/catalog";
import { resolveProductImage } from "../../data/productImageResolver";
import "./ProductThumb.css";

export interface ProductThumbProps {
  product: Product;
  /** Altura da moldura; use "sm" em listas densas e "md" em cartões de vitrine. */
  size?: "sm" | "md" | "lg";
  className?: string;
  eager?: boolean;
}

/**
 * Foto real do produto com placeholder visível enquanto carrega.
 *
 * Motivo: as listas de categoria e cidade mostravam apenas texto (ou um bloco
 * cinza sem estado), o que fazia o catálogo parecer vazio. Aqui o esqueleto fica
 * visível até o `onLoad`, e o fallback só aparece quando a imagem realmente
 * falha — nunca um espaço morto.
 */
export function ProductThumb({ product, size = "md", className = "", eager = false }: ProductThumbProps) {
  const source = resolveProductImage(product);
  const [state, setState] = useState<"loading" | "ready" | "failed">(source ? "loading" : "failed");

  useEffect(() => {
    setState(source ? "loading" : "failed");
  }, [source]);

  return (
    <span className={`pthumb pthumb--${size}${state === "loading" ? " is-loading" : ""} ${className}`.trim()}>
      {source && state !== "failed" && (
        <img
          src={source}
          alt={product.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
      {state === "failed" && (
        <span className="pthumb__fallback" role="img" aria-label={`Foto de ${product.name} indisponível`}>
          <><ImageOff aria-hidden="true" /><small>Imagem indisponível</small></>
        </span>
      )}
    </span>
  );
}

export default ProductThumb;
