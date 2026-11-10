import { expect, it } from "vitest";
import { updateLife } from "./civilization";
import { getRelation } from "./diplomacy";
import { generate, validate } from "./engine";
import { fleetEra, fleetProfile } from "./fleet";
import { frontierYear } from "./frontier";
import { adjacent, buildGeography, buildableHighland } from "./geography";
import { degradeDryLand } from "./living";
import { emptyStock } from "./livingTypes";
import { strategicWarYear } from "./strategicWar";
import { transportYear } from "./transport";
import { DYNAMIC_TILE_FIELDS, patchWorld, tileStamp } from "./wire";

const make = () =>
  generate({
    seed: 42,
    size: 48,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });

it("fits fleets to available power and preserves the fitting during transit", () => {
  const w = make();
  const [n] = w.nations;
  n.tech = 140;
  n.wealth = 60;
  expect(fleetEra(n, 0)).toBe(8);
  expect(fleetEra(n, 2)).toBe(11);
  expect(fleetProfile("sea", 11).speed).toBeGreaterThan(
    fleetProfile("sea", 8).speed,
  );
  expect(fleetProfile("sea", 11).cargo).toBeGreaterThan(
    fleetProfile("sea", 8).cargo,
  );

  const [a, b] = w.life!.settlements;
  w.life!.polities[0].energy = 2;
  for (const tile of w.tiles) tile.owner = 0;
  w.living!.lastNetwork = w.year = 1;
  a.urban!.stock = emptyStock();
  b.urban!.stock = emptyStock();
  a.urban!.stock.iron = 100;
  w.living!.routes = [
    {
      id: 999,
      from: a.id,
      to: b.id,
      mode: "sea",
      path: Array.from({ length: 15 }, (_, i) => a.tile + i),
      capacity: 4,
      delivered: 0,
      blocked: false,
      built: 0,
    },
  ];
  transportYear(w);
  const [v] = w.living!.vehicles;
  expect(v.fittedEra).toBe(11);
  expect(v.cargo.iron).toBe(8);
  expect(v.progress).toBe(3.2);
  b.urban!.outageUntil = 4;
  w.year = 2;
  transportYear(w);
  expect(v.progress).toBe(3.2);
  expect(v.cargo.iron).toBe(8);
  w.year = 4;
  n.wealth = 0;
  transportYear(w);
  expect(v.progress).toBe(6.4);
});

it("attacks a connected enemy city only during war and records a timed outage", () => {
  const w = make();
  const [a, b] = w.nations;
  const city = w.life!.settlements.find((c) => c.nation === b.id)!;
  const r = getRelation(w, a.id, b.id);
  a.tech = b.tech = 100;
  a.wealth = 200;
  city.network = 0.5;
  w.life!.polities.find((p) => p.nation === a.id)!.energy = 2;
  w.year = 16;
  strategicWarYear(w);
  expect(city.urban!.outageUntil).toBeUndefined();
  r.war = true;
  strategicWarYear(w);
  expect(city.urban!.outageUntil).toBe(21);
  expect(a.wealth).toBe(180);
  expect(w.history.at(-1)?.text).toContain("사이버 공격");
  expect(validate(structuredClone(w))).toBe(true);
});

it("spends stock on missiles, saves the flight and damages infrastructure only on arrival", () => {
  const w = make();
  const [a, b] = w.nations;
  const [source, target] = w.life!.settlements;
  const r = getRelation(w, a.id, b.id);
  r.war = true;
  a.tech = 150;
  a.wealth = 200;
  source.urban!.stock.metal = 10;
  source.urban!.stock.oil = 3;
  w.life!.polities[0].energy = 2;
  const tile = w.tiles[target.tile];
  tile.road = 1;
  tile.rail = 1;
  w.year = 16;
  strategicWarYear(w);
  const [missile] = w.missiles!;
  expect(source.urban!.stock.metal).toBe(4);
  expect(source.urban!.stock.oil).toBe(2);
  expect(tile.damage).toBe(0);
  expect(validate(structuredClone(w))).toBe(true);
  const peace = structuredClone(w);
  getRelation(peace, a.id, b.id).war = false;
  peace.year = missile.arrives;
  strategicWarYear(peace);
  expect(peace.tiles[target.tile].damage).toBe(0);
  const defended = structuredClone(w);
  defended.nations[b.id - 1].tech = 160;
  defended.life!.polities[1].energy = 2;
  defended.life!.settlements[1].urban!.stock.metal = 2;
  defended.year = missile.arrives;
  strategicWarYear(defended);
  expect(defended.tiles[target.tile].damage).toBe(0);
  expect(defended.life!.settlements[1].urban!.stock.metal).toBe(1);
  expect(defended.history.at(-1)?.text).toContain("요격");
  w.year = missile.arrives;
  strategicWarYear(w);
  expect(tile.damage).toBeCloseTo(0.28);
  expect(tile.rail).toBeCloseTo(0.7);
  expect(target.urban!.damage).toBeCloseTo(0.3);
  expect(w.missiles).toEqual([]);
});

it("desertification changes the live map, and river valleys resist it", () => {
  const w = make();
  const i = w.nations[0].capital;
  const j = adjacent(w, i)[0];
  for (const index of [i, j])
    Object.assign(w.tiles[index], {
      t: 2,
      moisture: 0.3,
      temperature: 0.75,
      fertility: 0.6,
      degradation: 0.99,
      lake: false,
      river: 0,
    });
  w.tiles[j].river = 0.6;
  const prior = structuredClone(w);
  expect(degradeDryLand(w, [i, j], 0.4)).toEqual([i]);
  const { tiles, ...meta } = w;
  expect(tileStamp(tiles[i])).not.toEqual(tileStamp(prior.tiles[i]));
  expect(
    patchWorld(prior, meta, [
      { index: i, values: DYNAMIC_TILE_FIELDS.map((key) => tiles[i][key]) },
    ]).tiles[i].biome,
  ).toBe("arid");
  buildGeography(w);
  expect(tiles[i].biome).toBe("arid");
  expect(tiles[i].baseFertility).toBe(0.22);
});

it("a state can replant clear-cut land, and the saplings regrow", () => {
  const w = make();
  const [n] = w.nations;
  const c = w.life!.settlements[0];
  const i = adjacent(w, c.tile)[0];
  Object.assign(w.tiles[i], {
    t: 3,
    wood: 0,
    moisture: 0.75,
    owner: n.id,
    lake: false,
    river: 0,
    irrigated: false,
  });
  c.urban!.stock.timber = 0;
  c.urban!.stock.food = 100;
  n.tech = 30;
  n.wealth = 200;
  w.year = 48;
  frontierYear(w);
  const project = w.living!.projects!.find((p) => p.nation === n.id)!;
  expect(project.kind).toBe("forestry");
  expect(project.tile).toBe(i);
  for (let k = 0; k < 10; k++) {
    w.year++;
    frontierYear(w);
  }
  expect(w.tiles[i].wood).toBe(12);
  updateLife(w, new Map());
  expect(w.tiles[i].wood).toBeGreaterThan(12);
});

it("settles a suitable highland mine but rejects a steep peak", () => {
  const w = make();
  const [n] = w.nations;
  const c = w.life!.settlements[0];
  const i = w.tiles.findIndex(
    (_, index) =>
      index > 2 * w.width &&
      index < w.tiles.length - 2 * w.width &&
      index % w.width > 1 &&
      index % w.width < w.width - 2 &&
      Math.abs((index % w.width) - (c.tile % w.width)) > 6,
  );
  Object.assign(w.tiles[i], {
    t: 4,
    owner: n.id,
    elevation: 0.88,
    deposits: { iron: 50 },
    lake: false,
    river: 0,
  });
  for (const j of adjacent(w, i))
    Object.assign(w.tiles[j], { t: 4, elevation: 0.5, lake: false, river: 0 });
  expect(buildableHighland(w, i)).toBe(false);
  for (const j of adjacent(w, i).slice(0, 2)) w.tiles[j].elevation = 0.86;
  expect(buildableHighland(w, i)).toBe(true);
  n.tech = 60;
  n.population = 400;
  n.wealth = 200;
  w.life!.polities[0].wood = 50;
  w.year = 3;
  updateLife(w, new Map([[n.id, [c.tile, i]]]));
  expect(
    w.life!.settlements.some((city) => city.nation === n.id && city.tile === i),
  ).toBe(true);
  expect(w.history.some((e) => e.text.includes("산악 광산"))).toBe(true);
});
