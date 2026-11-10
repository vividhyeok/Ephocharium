import { expect, it } from "vitest";
import { generate, step, validate } from "./engine";
import { adjacent } from "./geography";
import { oceanicTerrain } from "./oceanicTerrain";

const options = {
  preset: "dawn",
  layout: "oceanic",
  seed: 241026,
  size: 112,
  sea: 0.68,
  forest: 0.4,
  mountains: 0.07,
} as const;

it.each([42, 91, 241026])(
  "seed %i starts with a majority ocean and multiple large landmasses",
  (seed) => {
    const w = generate({ ...options, seed });
    const land = w.tiles.filter((t) => t.t !== 0).length;
    expect(1 - land / w.tiles.length).toBeCloseTo(0.68, 3);
    const seen = new Set<number>(),
      sizes: number[] = [];
    for (let i = 0; i < w.tiles.length; i++) {
      const x = i % w.width,
        y = Math.floor(i / w.width);
      if (x < 2 || x >= w.width - 2 || y < 2 || y >= w.height - 2)
        expect(w.tiles[i].t).toBe(0);
      if (w.tiles[i].t === 0 || seen.has(i)) continue;
      const q = [i];
      seen.add(i);
      for (let k = 0; k < q.length; k++)
        for (const j of adjacent(w, q[k]))
          if (w.tiles[j].t !== 0 && !seen.has(j)) {
            seen.add(j);
            q.push(j);
          }
      sizes.push(q.length);
    }
    expect(sizes.filter((n) => n > land * 0.17).length).toBeGreaterThanOrEqual(
      2,
    );
    for (let i = 0; i < 12; i++) step(w);
    expect(w.nations.filter((n) => n.alive).length).toBeGreaterThanOrEqual(4);
    expect(validate(w)).toBe(true);
  },
);

it("water coverage follows the requested slider value without changing a seeded layout randomly", () => {
  for (const ratio of [0.32, 0.55, 0.8]) {
    const heights = oceanicTerrain(-391, 80, 52, ratio);
    expect(heights.filter((v) => v < 0).length / heights.length).toBeCloseTo(
      ratio,
      3,
    );
    expect(heights).toEqual(oceanicTerrain(-391, 80, 52, ratio));
  }
});
