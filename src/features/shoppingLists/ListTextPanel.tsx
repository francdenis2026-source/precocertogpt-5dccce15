import { useMemo, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import type { Product } from "../../data/catalog";
import { matchListLines, parseListText, type MatchedLine } from "../../lib/listTextParser";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Cliente escreve a lista em texto; o sistema mostra o que achou antes de adicionar. */
export function ListTextPanel({ catalog, onAdd }: {
  catalog: Product[];
  onAdd: (productId: string, quantity: number) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [matched, setMatched] = useState<MatchedLine[] | null>(null);
  const [busy, setBusy] = useState(false);

  const found = (matched ?? []).filter(line => line.product);
  const notFound = (matched ?? []).filter(line => !line.product);
  const subtotal = useMemo(() => found.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0), [found]);

  function review() {
    setMatched(matchListLines(parseListText(text), catalog));
  }

  async function addFound() {
    setBusy(true);
    for (const line of found) {
      await onAdd(String(line.product!.id), line.quantity);
    }
    setBusy(false);
    setText("");
    setMatched(null);
  }

  return <section className="pc-lists-textpanel">
    <p className="pc-lists-textpanel__intro"><Sparkles aria-hidden="true" /> Escreva o que precisa e veja o que o sistema encontrou antes de adicionar.</p>
    <textarea
      value={text}
      onChange={e => { setText(e.target.value); setMatched(null); }}
      placeholder={"Ex.: 2 kg de carne, 1 café, 2 leite, arroz\nUm item por linha ou separado por vírgula"}
      rows={4}
    />
    <button type="button" onClick={review} disabled={!text.trim()}>Ver o que encontrei</button>

    {matched && <div className="pc-lists-textpanel__result">
      {found.length > 0 && <ul>
        {found.map((line, i) => <li key={`${line.raw}-${i}`}>
          <span><strong>{line.product!.name}</strong><small>{line.quantity}× · {brl.format(line.price ?? 0)} cada</small></span>
          <em>{brl.format((line.price ?? 0) * line.quantity)}</em>
        </li>)}
      </ul>}
      {found.length > 0 && <p className="pc-lists-textpanel__total">Subtotal estimado: <strong>{brl.format(subtotal)}</strong></p>}
      {notFound.length > 0 && <p className="pc-lists-textpanel__missing" role="status">
        Não encontramos: {notFound.map(line => `“${line.raw}”`).join(", ")}. Tente outro nome ou use a busca de produtos acima.
      </p>}
      {found.length > 0 && <button type="button" onClick={() => void addFound()} disabled={busy}>
        {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />} Adicionar {found.length} {found.length === 1 ? "item" : "itens"} à lista
      </button>}
    </div>}
  </section>;
}
