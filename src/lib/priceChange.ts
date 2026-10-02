export type PriceChange = { dir: "up" | "down"; diff: number; pct: number };

// Só avisa alterações recentes: previous_value fica guardado indefinidamente.
const RECENT_DAYS = 14;

export function priceChange(
  current: number | undefined,
  previous: number | undefined,
  capturedAt?: string | null,
): PriceChange | null {
  if (!current || !previous || current === previous) return null;
  const at = capturedAt ? Date.parse(capturedAt) : NaN;
  if (Number.isFinite(at) && Date.now() - at > RECENT_DAYS * 864e5) return null;
  const diff = Math.abs(current - previous);
  return { dir: current > previous ? "up" : "down", diff, pct: Math.round((diff / previous) * 100) };
}
