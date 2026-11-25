import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import type { Product } from "../../data/catalog";
import { supabase } from "../../lib/supabase";

/** Sugere os produtos que o cliente mais costuma colocar nas próprias listas (outras listas dele). */
export function HistorySuggestions({ catalog, currentProductIds, onAdd }: {
  catalog: Product[];
  currentProductIds: Set<string>;
  onAdd: (productId: string, quantity: number) => Promise<void>;
}) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("shopping_list_items")
        .select("product_id, quantity, shopping_lists!inner(user_id)")
        .eq("shopping_lists.user_id", userId)
        .limit(500);
      if (!active || !data) return;
      const map = new Map<string, number>();
      for (const row of data as { product_id: string | number; quantity: number }[]) {
        const key = String(row.product_id);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      setCounts(map);
    })();
    return () => { active = false; };
  }, []);

  const suggestions = useMemo(() => {
    const byId = new Map(catalog.map(p => [String(p.id), p]));
    return [...counts.entries()]
      .filter(([id]) => !currentProductIds.has(id) && byId.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => byId.get(id)!);
  }, [counts, catalog, currentProductIds]);

  if (!suggestions.length) return null;

  return <section className="pc-lists-history">
    <p><History aria-hidden="true" /> Você costuma comprar</p>
    <div className="pc-lists-history__chips">
      {suggestions.map(product => <button key={product.id} type="button" onClick={() => void onAdd(String(product.id), 1)}>
        + {product.name}
      </button>)}
    </div>
  </section>;
}
