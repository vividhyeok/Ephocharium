import { describe, expect, it } from "vitest";
import { generate, validate } from "./engine";
import { getRelation, treaty, updateDiplomacy } from "./diplomacy";
import { progressImperialRelations, raidForResources, regionalPolitics } from "./geopolitics";
import { effectiveWorkforce } from "./progression";

const make = () => generate({
  seed: 42, size: 48, preset: "four", sea: 0.4, forest: 0.35, mountains: 0.05,
});

describe("resource-driven geopolitical simulation", () => {
  it("raids transfer stored food and wealth, leave grievances, and obey a cooldown", () => {
    const w = make(), a = w.nations[0], b = w.nations[1];
    w.year = 101;
    a.population = 85; b.population = 95;
    a.wealth = 100; b.wealth = 200;
    b.food = 100;
    const city = w.life!.settlements.find((c) => c.nation === b.id)!;
    city.urban!.stock.food = 100;
    const r = getRelation(w, a.id, b.id);
    const beforeWealth = b.wealth;
    expect(raidForResources(w, r, a, b)).toBe(true);
    expect(b.wealth).toBeLessThan(beforeWealth);
    expect(r.grievance).toBeGreaterThan(0);
    expect(r.lastRaidYear).toBe(101);
    expect(raidForResources(w, r, a, b)).toBe(false);
    expect(w.diplomacyLog!.at(-1)?.kind).toBe("raid");
  });

  it("colonial tributaries are serializable and can gain independence", () => {
    const w = make(), a = w.nations[0], b = w.nations[1];
    w.year = 100;
    const r = getRelation(w, a.id, b.id);
    treaty(w, r, "subjugation", "전쟁 이후 종속 협정", a.id);
    expect(r.subject).toBe(b.id);
    expect(r.war).toBe(false);
    expect(validate(w)).toBe(true);
    b.population = 4000; b.tech = 200; b.stability = 0.95;
    a.population = 200; a.tech = 10;
    w.year = 181;
    updateDiplomacy(w);
    expect(r.subject).toBeUndefined();
    expect(w.diplomacyLog!.at(-1)?.kind).toBe("independence");
  });

  it("an overseas fleet resolves after arrival with economic and resistance conditions", () => {
    const w = make(), a = w.nations[0], b = w.nations[1];
    w.year = 120;
    a.population = 5000; a.tech = 100; a.stability = 0.9;
    b.population = 60; b.tech = 4;
    const r = getRelation(w, a.id, b.id);
    r.expedition = { invader: a.id, arrives: 120, strength: 1000 };
    expect(progressImperialRelations(w, r, a, b)).toBe(true);
    expect(r.subject).toBe(b.id);
    expect(r.expedition).toBeUndefined();
  });

  it("old all-to-all defensive alliances are limited without deleting national identities", () => {
    const w = make();
    w.year = 128;
    for (let i = 0; i < w.nations.length; i++)
      for (let j = i + 1; j < w.nations.length; j++)
        treaty(w, getRelation(w, i + 1, j + 1), "alliance", "구버전 동맹");
    const count = w.nations.length;
    regionalPolitics(w);
    for (const n of w.nations) {
      const active = w.relations.filter((r) =>
        r.allied && (r.a === n.id || r.b === n.id)).length;
      expect(active).toBeLessThanOrEqual(2);
    }
    expect(w.nations).toHaveLength(count);
    expect(validate(w)).toBe(true);
  });

  it("schooling and imports increase effective skilled labor but not actual population", () => {
    const w = make(), n = w.nations[0];
    const city = w.life!.settlements.find((c) => c.nation === n.id)!;
    const original = n.population;
    const baseline = effectiveWorkforce(w, n);
    city.urban!.education = 0.9;
    city.urban!.imported = 25;
    expect(effectiveWorkforce(w, n)).toBeGreaterThan(baseline);
    expect(n.population).toBe(original);
  });
});
