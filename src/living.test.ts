import { it, expect } from "vitest";
import { generate, step, validate, apply } from "./engine";
import { buildGeography } from "./geography";
import { manufacturing, extract } from "./resources";
import { emptyStock } from "./livingTypes";
import { demographicYear, sum } from "./demographics";
import { transportYear } from "./transport";
import { blendCulture } from "./culture";
import { patchWorld, DYNAMIC_TILE_FIELDS } from "./wire";
import { objectSvg } from "./art";
const make = () =>
  generate({
    seed: 42,
    size: 48,
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
    preset: "four",
  });
it("all four shores are sea; every drainage edge descends and rebuilding does not fertilize repeatedly", () => {
  const w = make();
  expect(
    w.tiles.every((t, i) =>
      i < w.width ||
      i >= w.tiles.length - w.width ||
      i % w.width === 0 ||
      i % w.width === w.width - 1
        ? t.t === 0
        : true,
    ),
  ).toBe(true);
  for (const t of w.tiles)
    if (t.downstream! >= 0)
      expect(w.tiles[t.downstream!].spill).toBeLessThan(t.spill!);
  buildGeography(w);
  const fertility = w.tiles.map((t) => t.fertility);
  buildGeography(w);
  expect(w.tiles.map((t) => t.fertility)).toEqual(fertility);
  expect(validate(w)).toBe(true);
});
it("iron and fuel are both consumed; lack of fuel stops smelting; extraction cannot create ore", () => {
  const stocked = emptyStock();
  stocked.iron = 10;
  stocked.coal = 10;
  const dry = { ...stocked, coal: 0 };
  expect(manufacturing(stocked, 7, 100, 1, 100).metal).toBeGreaterThan(0);
  expect(manufacturing(dry, 7, 100, 1, 100).metal).toBe(0);
  expect(stocked.iron).toBeLessThan(10);
  expect(stocked.coal).toBeLessThan(10);
  const t = make().tiles[0];
  t.deposits = { iron: 0.25 };
  expect(extract(t, "iron", 5)).toBe(0.25);
  expect(extract(t, "iron", 5)).toBe(0);
});
it("nutrition, medicine and sanitation affect life expectancy; ageing preserves nonnegative cohorts", () => {
  const w = make(),
    healthy = structuredClone(w.life!.settlements[0].urban!),
    crisis = structuredClone(healthy);
  healthy.cohorts = [100, 200, 50];
  healthy.capacity = 1000;
  healthy.stock.food = 10000;
  healthy.water = 1;
  healthy.sanitation = 1;
  healthy.medicine = 1;
  crisis.cohorts = [100, 200, 50];
  crisis.capacity = 100;
  crisis.stock.food = 0;
  crisis.water = 0;
  crisis.sanitation = 0;
  crisis.medicine = 0;
  demographicYear(healthy, 10, 1, false, 0);
  demographicYear(crisis, 10, 0.2, true, 1);
  expect(healthy.lifeExpectancy).toBeGreaterThan(crisis.lifeExpectancy);
  expect(crisis.deaths).toBeGreaterThan(healthy.deaths);
  expect(crisis.cohorts.every((v) => v >= 0)).toBe(true);
});
it("cargo leaves a real warehouse and arrives only after traversing its route", () => {
  const w = make(),
    [a, b] = w.life!.settlements;
  w.living!.routes = [
    {
      id: 999,
      from: a.id,
      to: b.id,
      mode: "road",
      path: Array.from({ length: 12 }, (_, i) => a.tile + i),
      capacity: 4,
      delivered: 0,
      blocked: false,
      built: 0,
    },
  ];
  w.living!.lastNetwork = w.year = 1;
  w.relations = [];
  for (const t of w.tiles) t.owner = 0;
  a.urban!.stock = emptyStock();
  b.urban!.stock = emptyStock();
  a.urban!.stock.iron = 100;
  const total = () =>
    a.urban!.stock.iron +
    b.urban!.stock.iron +
    w.living!.vehicles.reduce((s, v) => s + (v.cargo.iron || 0), 0);
  transportYear(w);
  expect(a.urban!.stock.iron).toBeLessThan(100);
  expect(b.urban!.stock.iron).toBe(0);
  expect(total()).toBeCloseTo(100);
  for (let i = 0; i < 12; i++) transportYear(w);
  expect(b.urban!.stock.iron).toBeGreaterThan(0);
  expect(total()).toBeCloseTo(100);
});
it("transported culture mixing remains normalized and differs from isolation", () => {
  const w = make();
  w.nations[0].culture!.shares = [1, 0, 0, 0, 0];
  w.nations[1].culture!.shares = [0, 1, 0, 0, 0];
  blendCulture(w, 1, 2, 0.1);
  expect(w.nations[0].culture!.shares[1]).toBeCloseTo(0.1);
  expect(w.nations[0].culture!.shares.reduce((s, v) => s + v, 0)).toBeCloseTo(
    1,
  );
});
it("resource intervention updates the actual finite deposits", () => {
  const w = make(),
    i = w.nations[0].capital;
  apply(w, "resource", i, 0);
  expect(w.tiles[i].deposits!.iron).toBe(160);
});
it("worker tile patches preserve a full snapshot without mutating the previous one", () => {
  const w = make(),
    next = structuredClone(w);
  next.tiles[5].owner = 1;
  next.tiles[5].deposits = { iron: 15 };
  next.year++;
  const { tiles, ...meta } = next;
  const result = patchWorld(w, meta, [
    { index: 5, values: DYNAMIC_TILE_FIELDS.map((k) => tiles[5][k]) },
  ]);
  expect(result).toEqual(next);
  expect(w.tiles[5].owner).not.toBe(1);
});
it("new tool art has distinct inspect, meteor, plague, fire and erase silhouettes", () => {
  const art = ["inspect", "meteor", "plague", "fire", "erase"].map((k) =>
    objectSvg(k),
  );
  expect(new Set(art).size).toBe(5);
  expect(art.every((s) => s.includes("<svg"))).toBe(true);
});
it("a restored living world follows the identical future including deposits and routes", () => {
  const w = make();
  for (let i = 0; i < 37; i++) step(w);
  const copy = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 25; i++) {
    step(w);
    step(copy);
  }
  expect(copy).toEqual(w);
  expect(validate(copy)).toBe(true);
});
