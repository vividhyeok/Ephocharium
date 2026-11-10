import { regionalPolitics } from "./geopolitics";
import { urbanYear } from "./living";
import { it, expect } from "vitest";
import { generate, validate, step } from "./engine";
import {
  planCampaign,
  negotiatePassage,
  enterNeutral,
  navalSupplyOpen,
} from "./campaigns";
import { nationalStrategy } from "./strategy";
import { getRelation, treaty } from "./diplomacy";
import { updateArmies } from "./civilization";
import { stockNation } from "./resources";
const make = () =>
  generate({
    seed: 42,
    size: 32,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
function corridor() {
  const w = make();
  w.tiles.forEach((t) => {
    t.t = 0;
    t.lake = false;
    t.owner = 0;
    t.river = 0;
  });
  const row = 5 * w.width;
  for (let x = 2; x <= 24; x++) {
    const t = w.tiles[row + x];
    t.t = 2;
    t.owner = x < 8 ? 1 : x < 17 ? 2 : 3;
  }
  [3, 12, 22].forEach((x, k) => {
    const n = w.nations[k];
    n.capital = row + x;
    n.population = k ? 100 : 2000;
    n.tech = k ? 1 : 17;
    n.stability = 0.8;
  });
  return { w, row };
}
it("a refused corridor cannot be crossed by a weak neutral army; negotiated access expires", () => {
  const { w, row } = corridor();
  w.nations[0].aggression = 0.2;
  expect(planCampaign(w, 1, 3, row + 3, row + 22)).toBeUndefined();
  getRelation(w, 1, 2).score = 0.5;
  const p = planCampaign(w, 1, 3, row + 3, row + 22)!;
  expect(p.passage).toEqual([2]);
  expect(getRelation(w, 1, 2).accessUntil).toBeUndefined();
  negotiatePassage(w, 1, p.passage);
  expect(enterNeutral(w, 1, 3, row + 8)).toBe(0);
  w.year += 41;
  expect(enterNeutral(w, 1, 3, row + 8)).toBe(2);
  expect(getRelation(w, 1, 2).war).toBe(true);
});
it("forced passage creates a separate real war with the intervening state and respects protection", () => {
  const { w, row } = corridor();
  w.nations[0].aggression = 0.9;
  expect(planCampaign(w, 1, 3, row + 3, row + 22)!.forced).toEqual([2]);
  expect(getRelation(w, 1, 2).war).toBe(false);
  expect(enterNeutral(w, 1, 3, row + 8)).toBe(2);
  expect(getRelation(w, 1, 2).war).toBe(true);
  expect(w.diplomacyLog!.at(-1)!.actor).toBe(1);
  w.nations[1].protected = true;
  expect(enterNeutral(w, 1, 3, row + 9)).toBe(-1);
});
function islands() {
  const { w, row } = corridor();
  for (let x = 8; x <= 19; x++) {
    w.tiles[row + x].t = 0;
    w.tiles[row + x].owner = 0;
  }
  w.nations[1].alive = false;
  w.nations[2].capital = row + 22;
  w.life!.settlements = w.life!.settlements.filter(
    (c) => c.nation === 1 || c.nation === 3,
  );
  for (const c of w.life!.settlements) {
    c.tile = w.nations[c.nation - 1].capital;
    c.urban!.stock.food = 5000;
    c.urban!.stock.timber = 100;
    c.urban!.operation = 1;
  }
  const home = w.life!.settlements.find((c) => c.nation === 1)!;
  home.tile = row + 7;
  w.nations[0].capital = home.tile;
  home.urban!.port = 1;
  home.urban!.portTile = row + 8;
  for (const n of w.nations) {
    stockNation(w, n);
    n.food = n.inventory!.food;
    n.wealth = 1000;
  }
  const contexts = new Map(
    [1, 3].map((id) => [
      id,
      {
        cells: w.tiles
          .map((t, i) => (t.owner === id ? i : -1))
          .filter((i) => i >= 0),
        cities: w.life!.settlements.filter((c) => c.nation === id),
        polity: w.life!.polities.find((p) => p.nation === id)!,
      },
    ]),
  );
  return { w, row, home, contexts };
}
it("a funded sea invasion physically moves across water, lands and loses supplies after its port is destroyed", () => {
  const { w, row, home, contexts } = islands();
  const plan = planCampaign(w, 1, 3, home.tile, row + 22)!;
  expect(plan.naval).toBe(true);
  expect(plan.path.some((i) => w.tiles[i].t === 0)).toBe(true);
  treaty(w, getRelation(w, 1, 3), "war", "test", 1);
  const timber = home.urban!.stock.timber;
  updateArmies(w, contexts);
  const army = w.life!.armies.find((a) => a.nation === 1)!;
  expect(army.navalOrigin).toBe(home.tile);
  expect(home.urban!.stock.timber).toBeLessThan(timber);
  let atSea = false,
    landed = false;
  for (let i = 0; i < 50; i++) {
    w.year++;
    updateArmies(w, contexts);
    atSea ||=
      w.tiles[Math.floor(army.y) * w.width + Math.floor(army.x)].t === 0;
    landed ||= army.x >= 20;
  }
  expect(atSea).toBe(true);
  expect(landed).toBe(true);
  home.urban!.port = 0;
  expect(navalSupplyOpen(w, 1, home.tile, row + 20)).toBe(false);
  army.provisions = 0;
  const strength = army.strength;
  updateArmies(w, contexts);
  expect(army.strength).toBeLessThan(strength);
});
it("food scarcity and war yield different paid policies; saves reproduce future decisions", () => {
  const w = make(),
    n = w.nations[0],
    cells = w.tiles
      .map((t, i) => (t.owner === n.id ? i : -1))
      .filter((i) => i >= 0);
  n.food = 0;
  n.wealth = 1000;
  nationalStrategy(w, n, cells);
  expect(n.strategy!.priority).toBe("agriculture");
  expect(n.wealth).toBeLessThan(1000);
  const restored = structuredClone(w);
  expect(validate(restored)).toBe(true);
  for (let i = 0; i < 24; i++) {
    step(w);
    step(restored);
  }
  expect(restored).toEqual(w);
  const bad = structuredClone(w);
  bad.nations[0].strategy!.investment = NaN;
  expect(validate(bad)).toBe(false);
});

it("a resource-driven war can begin across an intervening state when a physical route exists", () => {
  const { w, row } = corridor();
  w.year = 160;
  w.nations[3].alive = false;
  const a = w.nations[0],
    b = w.nations[2];
  a.aggression = 0.95;
  a.food = 0;
  b.food = 2000;
  a.wealth = 1000;
  getRelation(w, 1, 3).score = -0.7;
  getRelation(w, 1, 3).since = 0;
  regionalPolitics(w);
  expect(getRelation(w, 1, 3).war).toBe(true);
  expect(planCampaign(w, 1, 3, row + 3, row + 22)).toBeDefined();
});
it("mobilization removes workers from production rather than supplying a free army", () => {
  const peaceful = make(),
    mobilized = structuredClone(peaceful),
    n = mobilized.nations[0];
  const c = mobilized.life!.settlements.find((c) => c.nation === 1)!;
  mobilized.life!.armies.push({
    id: 99999,
    nation: 1,
    enemy: 2,
    x: (c.tile % mobilized.width) + 0.5,
    y: Math.floor(c.tile / mobilized.width) + 0.5,
    previousX: 0,
    previousY: 0,
    route: [],
    target: c.tile,
    strength: 100,
    siege: 0,
    fighting: false,
  });
  c.urban!.cohorts[1] = 8;
  peaceful.life!.settlements.find((c) => c.nation === 1)!.urban!.cohorts[1] = 8;
  const holdings = (w: typeof peaceful) =>
    new Map(
      w.nations.map((n) => [
        n.id,
        w.tiles
          .map((t, i) => (t.owner === n.id ? i : -1))
          .filter((i) => i >= 0),
      ]),
    );
  urbanYear(peaceful, holdings(peaceful));
  urbanYear(mobilized, holdings(mobilized));
  expect(c.urban!.produced).toBeLessThan(
    peaceful.life!.settlements.find((c) => c.nation === 1)!.urban!.produced,
  );
});

it("hostile island states can start an overseas war without tech dominance or starvation, and land the army", () => {
  const { w, home, contexts } = islands();
  w.year = 160;
  w.nations[3].alive = false;
  const a = w.nations[0],
    b = w.nations[2];
  a.tech = b.tech = 17;
  a.population = 1200;
  b.population = 600;
  a.aggression = 0.95;
  b.aggression = 0.6;
  a.stability = b.stability = 0.8;
  const relation = getRelation(w, 1, 3);
  relation.score = -0.8;
  relation.grievance = 0.6;
  relation.since = 0;
  home.urban!.port = 0;
  regionalPolitics(w);
  expect(relation.war).toBe(false);
  home.urban!.port = 1;
  regionalPolitics(w);
  expect(relation.war).toBe(true);
  expect(relation.reason).toContain("해상 침공");
  for (let i = 0; i < 30; i++) {
    updateArmies(w, contexts);
    w.year++;
  }
  expect(
    w.life!.armies.some(
      (a) => a.nation === 1 && a.navalOrigin === home.tile && a.x >= 20,
    ),
  ).toBe(true);
});
