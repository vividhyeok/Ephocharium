import { it, expect } from "vitest";
import { generate, step, validate } from "./engine";
import { ERAS, eraOf } from "./eras";
import {
  prepareProgress,
  researchRate,
  updateDirection,
  updateIndustry,
} from "./progression";
import { advanceClock } from "./time";
import { getRelation, treaty } from "./diplomacy";
import { intervene } from "./intervention";
import { expandAtlas } from "./history";
const make = () =>
  generate({
    seed: 91,
    size: 48,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
it("all fourteen stages have distinct thresholds and effective food, income, housing and transport changes", () => {
  expect(ERAS).toHaveLength(14);
  for (let i = 1; i < ERAS.length; i++) {
    expect(ERAS[i].threshold).toBeGreaterThan(ERAS[i - 1].threshold);
    expect(ERAS[i].food).toBeGreaterThan(ERAS[i - 1].food);
    expect(ERAS[i].income).toBeGreaterThan(ERAS[i - 1].income);
    expect(eraOf({ tech: ERAS[i].threshold })).toBe(i);
  }
});
it("1x and 20x compute exactly the same world for the same simulated duration", () => {
  const a = make(),
    b = structuredClone(a);
  for (let i = 0; i < 4000; i++) advanceClock(a, 1);
  for (let i = 0; i < 200; i++) advanceClock(b, 20);
  expect(a.year).toBe(100);
  expect(a).toEqual(b);
  expect(validate(a)).toBe(true);
  const slow = make(),
    fast = structuredClone(slow);
  advanceClock(slow, 1, 10);
  advanceClock(fast, 20, 10);
  expect(slow.year).toBe(0);
  expect(fast.year).toBe(5);
});
it("old aviation progress migrates once without losing the year, population or random state", () => {
  const w = make();
  delete w.progressRevision;
  w.nations[0].tech = 7.5;
  const rng = w.rng,
    pop = w.nations[0].population;
  prepareProgress(w);
  expect(eraOf(w.nations[0])).toBe(10);
  expect(w.year).toBe(0);
  expect(w.rng).toBe(rng);
  expect(w.nations[0].population).toBe(pop);
  const once = structuredClone(w);
  prepareProgress(w);
  expect(w).toEqual(once);
  expect(validate(w)).toBe(true);
});
it("research can decline during crisis and resume after recovery; directions adapt to conditions", () => {
  const w = make(),
    n = w.nations[0];
  n.tech = 40;
  n.stability = 0.1;
  expect(researchRate(w, n)).toBeLessThan(0);
  n.stability = 1;
  n.food = 10000;
  n.wealth = 10000;
  n.population = 1000; // Recovery also needs the workforce required to sustain this era.
  expect(researchRate(w, n)).toBeGreaterThan(0);
  const cells = w.tiles
      .map((t, i) => (t.owner === n.id ? i : -1))
      .filter((i) => i >= 0),
    before = n.tendencies!.military;
  treaty(w, getRelation(w, 1, 2), "war", "자원 분쟁", 1);
  for (let i = 0; i < 100; i++) updateDirection(w, n, cells);
  expect(n.tendencies!.military).toBeGreaterThan(before);
});
it("late industry, power, networks, orbit and exploration consume resources and change income beyond the final era", () => {
  const w = make(),
    n = w.nations[0],
    p = w.life!.polities[0],
    c = w.life!.settlements[0];
  n.tech = 310;
  n.population = 5000;
  n.stability = 1;
  n.food = 100000;
  n.wealth = 100000;
  p.metal = 100;
  c.urban!.stock.metal = 100;
  p.energy = 5;
  c.industry = 0;
  c.network = 0;
  c.development = 14;
  const metal = p.metal;
  updateIndustry(w, n);
  expect(p.satellites).toBeGreaterThan(0);
  expect(p.probes).toBeGreaterThan(0);
  expect(p.metal).toBeLessThan(metal);
  expect(c.industry).toBeGreaterThan(0);
  expect(c.network).toBeGreaterThan(0);
  expect(researchRate(w, n)).toBeGreaterThan(0);
  const oldTech = n.tech,
    oldDevelopment = c.development;
  for (let i = 0; i < 60; i++) {
    n.stability = 1;
    for (const city of w.life!.settlements.filter((x) => x.nation === n.id)) {
      if (!city.urban) continue;
      city.urban!.stock.food = 100000;
      city.urban!.stock.coal = 100;
    }
    n.food =
      100000 * w.life!.settlements.filter((x) => x.nation === n.id).length;
    step(w);
  }
  expect(n.tech).toBeGreaterThan(oldTech);
  expect(c.development).toBeGreaterThan(oldDevelopment);
  expect(validate(w)).toBe(true);
});
it("explicit intervention uses the selected pair and explains a missing front", () => {
  const w = make();
  const text = intervene(w, 1, 3, "war");
  expect(getRelation(w, 1, 3).war).toBe(true);
  expect(text).toContain("접경이 없어");
  expect(getRelation(w, 1, 2).war).toBe(false);
  intervene(w, 1, 3, "peace");
  expect(getRelation(w, 1, 3).war).toBe(false);
});
it("history summaries and compressed territorial observations survive save and reject damaged new data", () => {
  const w = make();
  for (let i = 0; i < 100; i++) step(w);
  expect(w.chronicle!.length).toBeGreaterThan(0);
  expect(w.atlases).toHaveLength(1);
  expect(expandAtlas(w.atlases![0])).toEqual(w.tiles.map((t) => t.owner));
  expect(validate(JSON.parse(JSON.stringify(w)))).toBe(true);
  const bad = structuredClone(w);
  bad.atlases![0].owners = [1, 9999999];
  expect(validate(bad)).toBe(false);
});
