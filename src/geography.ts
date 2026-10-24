import type { World, Tile } from "./engine";
import type { Material } from "./livingTypes";
export const hash = (seed: number, x: number, y: number) => {
  let n = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1597334677);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const smooth = (seed: number, x: number, y: number, scale: number) => {
  const a = Math.floor(x / scale),
    b = Math.floor(y / scale),
    u = (x / scale - a) ** 2 * (3 - 2 * (x / scale - a)),
    v = (y / scale - b) ** 2 * (3 - 2 * (y / scale - b));
  return (
    (hash(seed, a, b) * (1 - u) + hash(seed, a + 1, b) * u) * (1 - v) +
    (hash(seed, a, b + 1) * (1 - u) + hash(seed, a + 1, b + 1) * u) * v
  );
};
export const adjacent = (w: World, i: number) =>
  [
    i % w.width ? i - 1 : -1,
    i % w.width < w.width - 1 ? i + 1 : -1,
    i - w.width,
    i + w.width,
  ].filter((j) => j >= 0 && j < w.tiles.length);
export class MinHeap {
  heap: { i: number; v: number }[] = [];
  push(i: number, v: number) {
    const a = this.heap;
    a.push({ i, v });
    let k = a.length - 1;
    while (k) {
      const p = (k - 1) >> 1;
      if (a[p].v <= v) break;
      a[k] = a[p];
      k = p;
    }
    a[k] = { i, v };
  }
  pop() {
    const a = this.heap,
      root = a[0],
      last = a.pop()!;
    if (a.length) {
      let k = 0;
      while (k * 2 + 1 < a.length) {
        let j = k * 2 + 1;
        if (j + 1 < a.length && a[j + 1].v < a[j].v) j++;
        if (a[j].v >= last.v) break;
        a[k] = a[j];
        k = j;
      }
      a[k] = last;
    }
    return root;
  }
  get length() {
    return this.heap.length;
  }
}
/** Priority flood yields a strictly descending spill surface and an acyclic drainage tree. */
export function buildGeography(w: World, newTerrain = false) {
  const heap = new MinHeap(),
    seen = new Uint8Array(w.tiles.length),
    order: number[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i],
      x = i % w.width,
      y = Math.floor(i / w.width);
    t.baseFertility ??= t.fertility;
    t.fertility = t.baseFertility;
    t.elevation =
      t.elevation ??
      (t.t === 0
        ? -0.15
        : t.t === 4
          ? 0.9
          : t.t === 5
            ? 0.7
            : 0.15 + smooth(w.seed, x, y, 11) * 0.55);
    t.moisture = 0.15 + smooth(w.seed + 19, x, y, 13) * 0.8;
    t.temperature = Math.max(
      0,
      1 - Math.abs(y / w.height - 0.62) * 1.2 - t.elevation * 0.38,
    );
    t.downstream = -1;
    t.flow = 0.4 + t.moisture;
    t.river = 0;
    t.depth = 0;
    t.lake = false;
    t.spill = t.elevation;
    if (t.t === 0) {
      seen[i] = 1;
      heap.push(i, t.elevation);
    }
  }
  // Worlds painted entirely as land still drain toward the rectangular edge.
  if (!heap.length)
    for (let i = 0; i < w.tiles.length; i++)
      if (
        i < w.width ||
        i >= w.tiles.length - w.width ||
        i % w.width === 0 ||
        i % w.width === w.width - 1
      ) {
        seen[i] = 1;
        heap.push(i, w.tiles[i].spill!);
      }
  while (heap.length) {
    const { i } = heap.pop();
    order.push(i);
    for (const j of adjacent(w, i)) {
      if (seen[j]) continue;
      seen[j] = 1;
      const t = w.tiles[j];
      t.spill = Math.max(t.elevation!, w.tiles[i].spill! + 0.00001);
      t.downstream = i;
      heap.push(j, t.spill);
    }
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k],
      t = w.tiles[i];
    if (t.t !== 0 && t.spill! - t.elevation! > 0.065) {
      t.lake = true;
      t.depth = Math.min(3, (t.spill! - t.elevation!) * 12);
      if (t.moisture! < 0.3) t.downstream = -1;
    }
    if (t.downstream! >= 0) w.tiles[t.downstream!].flow! += t.flow!;
  }
  const threshold = Math.max(9, w.tiles.length * 0.0022);
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i],
      x = i % w.width,
      y = Math.floor(i / w.width);
    if (t.t !== 0 && !t.lake && t.flow! > threshold) {
      t.river = Math.min(3, 0.35 + Math.log2(t.flow! / threshold + 1) * 0.4);
      t.depth = t.river * 0.6;
      t.fertility = Math.min(1, t.fertility + 0.2);
      for (const j of adjacent(w, i))
        if (w.tiles[j].t !== 0)
          w.tiles[j].fertility = Math.min(1, w.tiles[j].fertility + 0.06);
    }
    const delta = !!t.river && adjacent(w, i).some((j) => w.tiles[j].t === 0);
    t.biome = t.lake
      ? "lake"
      : delta
        ? "delta"
        : t.t === 0
          ? "ocean"
          : t.t === 5
            ? "snow"
            : t.elevation! > 0.78
              ? "highland"
              : t.moisture! < 0.3 && t.temperature! > 0.55
                ? "arid"
                : t.moisture! > 0.78 && t.elevation! < 0.3
                  ? "wetland"
                  : t.t === 3
                    ? "forest"
                    : "plain";
    if (newTerrain && t.t !== 0 && t.t !== 5 && !t.lake) {
      if (t.elevation! > 0.76 && smooth(w.seed + 431, x, y, 8) > 0.42) t.t = 4;
      else if (t.t === 4) t.t = t.moisture! > 0.55 ? 3 : 2;
      else if (t.biome === "arid") {
        t.t = 1;
        t.fertility = 0.22;
      } else if (t.biome === "wetland") t.fertility = 0.65;
    }
    if (!t.deposits) {
      t.deposits = {};
      for (const key of [
        "stone",
        "clay",
        "copper",
        "iron",
        "coal",
        "oil",
        "gold",
      ] as Material[]) {
        const noise = smooth(
          w.seed + key.length * 331 + key.charCodeAt(0) * 17,
          x,
          y,
          key === "stone" ? 9 : 7,
        );
        const suitability =
          key === "stone"
            ? t.elevation!
            : key === "clay"
              ? 1 - t.elevation!
              : key === "oil"
                ? 1 - Math.abs(t.elevation! - 0.25) * 2
                : key === "coal"
                  ? t.moisture!
                  : t.elevation! * 0.6 + 0.3;
        const density = Math.max(
          0,
          noise + suitability * 0.35 - (key === "gold" ? 1.06 : 0.86),
        );
        if (t.t !== 0 && density > 0)
          t.deposits[key] = Math.round(density * 1600);
      }
    }
  }
  if (w.living) {
    w.living.geographyRevision++;
    w.living.landRevision++;
    w.living.lastNetwork = -100;
  }
}
export const isWater = (t: Tile) =>
  t.t === 0 || !!t.lake || (t.river || 0) > 0.7;
export const crossingCost = (t: Tile) =>
  t.t === 4
    ? t.tunnel
      ? 1
      : 5
    : t.lake
      ? 99
      : (t.river || 0) > 1 && !t.bridge
        ? 3
        : 1 + (t.biome === "wetland" ? 1 : 0) + (t.biome === "arid" ? 0.5 : 0);
