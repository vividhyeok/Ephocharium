import { it, expect } from "vitest";
import { generate, step, validate } from "./engine";
import { launchSettlers } from "./settlement";
const dawn = (seed: number) =>
  generate({
    seed,
    preset: "dawn",
    size: 80,
    sea: 0.45,
    forest: 0.4,
    mountains: 0.07,
  });
it.each([42, 91, 241026])(
  "seed %i grows multiple independent nations and disputes without any intervention",
  (seed) => {
    const w = dawn(seed);
    expect(w.nations).toHaveLength(0);
    expect(w.settlers.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < 240; i++) step(w);
    expect(w.nations.filter((n) => n.parentId).length).toBeGreaterThan(3);
    expect(w.tiles.filter((t) => t.owner).length).toBeGreaterThan(500);
    expect(
      w.diplomacyLog!.some((e) => e.kind === "raid" || e.kind === "war"),
    ).toBe(true);
    expect(validate(w)).toBe(true);
  },
  20000,
);
it("launching a migration transfers existing people into a moving group", () => {
  const w = dawn(42);
  for (let i = 0; i < 12; i++) step(w);
  const n = w.nations[0],
    c = w.life!.settlements.find((c) => c.nation === n.id)!;
  n.population = 150;
  c.population = 150;
  c.urban!.cohorts = [45, 90, 15];
  c.urban!.stock.food = 200;
  n.food = 200;
  w.year = 48;
  const total = () =>
    w.nations.reduce((s, n) => s + n.population, 0) +
    w.settlers.reduce((s, g) => s + g.population, 0);
  const before = total();
  launchSettlers(w);
  const group = w.settlers.find((s) => s.parentId === n.id)!;
  expect(group.route!.length).toBeGreaterThan(4);
  expect(total()).toBeCloseTo(before);
  expect(c.urban!.stock.food + group.food!).toBeCloseTo(200);
});
