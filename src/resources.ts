import type { World, Nation, Tile } from "./engine";
import {
  MATERIALS,
  emptyStock,
  type Material,
  type Inventory,
} from "./livingTypes";
export function stockNation(w: World, n: Nation) {
  const stock = emptyStock();
  for (const c of w.life?.settlements || [])
    if (c.nation === n.id && c.urban)
      for (const k of MATERIALS) stock[k] += c.urban.stock[k];
  n.inventory = stock;
  const p = w.life?.polities.find((p) => p.nation === n.id);
  if (p) {
    p.wood = stock.timber;
    p.metal = stock.metal;
  }
  return stock;
}
export function consumeNation(
  w: World,
  n: Nation,
  key: Material,
  amount: number,
) {
  const cities =
    w.life?.settlements.filter((c) => c.nation === n.id && c.urban) || [];
  if (cities.reduce((a, c) => a + c.urban!.stock[key], 0) + 1e-8 < amount)
    return false;
  let left = amount;
  for (const c of cities) {
    const use = Math.min(c.urban!.stock[key], left);
    c.urban!.stock[key] -= use;
    left -= use;
  }
  if (n.inventory) n.inventory[key] = Math.max(0, n.inventory[key] - amount);
  return true;
}
export function creditNation(
  w: World,
  n: Nation,
  key: Material,
  amount: number,
) {
  const c = w.life?.settlements.find((c) => c.nation === n.id && c.urban);
  if (c) c.urban!.stock[key] += amount;
  if (n.inventory) n.inventory[key] += amount;
}
export function extract(t: Tile, key: Material, amount: number) {
  if (key === "timber") {
    const got = Math.min(t.wood || 0, amount);
    t.wood = Math.max(0, (t.wood || 0) - got);
    return got;
  }
  const got = Math.min(t.deposits?.[key] || 0, amount);
  if (t.deposits) t.deposits[key] = Math.max(0, (t.deposits[key] || 0) - got);
  return got;
}
export function manufacturing(
  stock: Inventory,
  era: number,
  labor: number,
  logistics: number,
  capital: number,
) {
  const efficiency =
    Math.min(1, labor / 60) *
    (0.3 + logistics * 0.7) *
    Math.min(1, capital / 50);
  let metal = 0,
    energy = 0;
  if (era >= 3) {
    const ore = Math.min(
      stock.iron,
      era >= 7 ? 2 * efficiency : 0.3 * efficiency,
    );
    const fuel =
      era >= 7
        ? Math.min(stock.coal, ore * 0.6)
        : Math.min(stock.timber, ore * 0.8);
    const batch = Math.min(ore, fuel / (era >= 7 ? 0.6 : 0.8));
    stock.iron -= batch;
    stock[era >= 7 ? "coal" : "timber"] -= batch * (era >= 7 ? 0.6 : 0.8);
    metal += batch * 0.75;
    const copper = Math.min(stock.copper, 0.15 * efficiency);
    stock.copper -= copper;
    metal += copper * 0.7;
  }
  if (era >= 11) {
    const reclaimed = Math.min(stock.metal * 0.001, 0.05 * efficiency);
    metal += reclaimed;
  }
  stock.metal += metal;
  if (era >= 7) {
    const fuel = Math.min(stock.coal + stock.oil, 0.3 * efficiency);
    const oil = Math.min(stock.oil, fuel);
    stock.oil -= oil;
    stock.coal = Math.max(0, stock.coal - (fuel - oil));
    energy = fuel * 5 + (era >= 12 ? efficiency * 0.8 : 0);
  }
  return { metal, energy, efficiency };
}
