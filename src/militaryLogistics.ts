import type { World, Nation } from "./engine";
import { adjacent } from "./geography";
const caches = new WeakMap<
  World,
  Map<number, { year: number; tiles: Set<number> }>
>();
export function supplyFactor(w: World, n: Nation, tile: number) {
  let cache = caches.get(w);
  if (!cache) {
    cache = new Map();
    caches.set(w, cache);
  }
  let c = cache.get(n.id);
  if (!c || c.year !== w.year) {
    const permitted = new Set([0, n.id]);
    for (const r of w.relations)
      if (
        (r.a === n.id || r.b === n.id) &&
        !r.war &&
        (r.allied ||
          r.subject ||
          (r.accessUntil !== undefined && r.accessUntil >= w.year))
      )
        permitted.add(r.a === n.id ? r.b : r.a);
    const tiles = new Set<number>(),
      q = [n.capital];
    tiles.add(n.capital);
    for (let p = 0; p < q.length; p++)
      for (const j of adjacent(w, q[p])) {
        const t = w.tiles[j];
        if (
          tiles.has(j) ||
          !permitted.has(t.owner) ||
          t.t === 0 ||
          t.lake ||
          ((t.river || 0) > 1.5 && !t.bridge)
        )
          continue;
        tiles.add(j);
        q.push(j);
      }
    c = { year: w.year, tiles };
    cache.set(n.id, c);
  }
  const bank = c.tiles.has(tile)
    ? tile
    : adjacent(w, tile).find((i) => c.tiles.has(i));
  if (bank === undefined || !c.tiles.has(bank)) return 0.15;
  const t = w.tiles[bank],
    industry = w
      .life!.settlements.filter((c) => c.nation === n.id)
      .reduce((s, c) => s + (c.industry || 0), 0);
  return Math.min(
    1.3,
    0.5 +
      (t.road || 0) * 0.25 +
      (t.rail || 0) * 0.25 +
      Math.min(0.25, industry * 0.02),
  );
}
export function populationLoss(w: World, n: Nation, amount: number) {
  if (!w.living) {
    n.population = Math.max(0, n.population - amount);
    return;
  }
  let left = amount;
  for (const c of w.life!.settlements.filter(
    (c) => c.nation === n.id && c.urban,
  )) {
    const adult = Math.min(c.urban!.cohorts[1], left);
    c.urban!.cohorts[1] -= adult;
    left -= adult;
    if (left <= 0) break;
  }
  if (left > 0)
    for (const c of w.life!.settlements.filter(
      (c) => c.nation === n.id && c.urban,
    ))
      for (const k of [0, 2]) {
        const v = Math.min(c.urban!.cohorts[k], left);
        c.urban!.cohorts[k] -= v;
        left -= v;
      }
  n.population = Math.max(0, n.population - (amount - left));
}
