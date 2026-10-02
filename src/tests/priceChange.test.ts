import { describe, expect, it } from "vitest";
import { priceChange } from "../lib/priceChange";

describe("priceChange", () => {
  const now = new Date().toISOString();
  it("detecta aumento e queda", () => {
    expect(priceChange(63, 61.99, now)).toMatchObject({ dir: "up" });
    expect(priceChange(10, 12, now)).toMatchObject({ dir: "down", diff: 2, pct: 17 });
  });
  it("ignora sem alteração ou alteração antiga", () => {
    expect(priceChange(10, 10, now)).toBeNull();
    expect(priceChange(10, undefined, now)).toBeNull();
    expect(priceChange(10, 12, "2020-01-01T00:00:00Z")).toBeNull();
  });
});
