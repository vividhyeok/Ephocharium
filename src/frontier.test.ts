import { getRelation } from "./diplomacy";
import { it, expect } from "vitest";
import { generate, validate } from "./engine";
import { frontierYear, settleExpedition } from "./frontier";
import { politicalColors } from "./politicalColors";
import { adjacent } from "./geography";
import type { Vehicle } from "./livingTypes";
const make = () =>
  generate({
    seed: 42,
    size: 48,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
it("alliance colours share a component without changing national ownership or identity", () => {
  const w = make(),
    identities = w.nations.map((n) => n.color),
    owners = w.tiles.map((t) => t.owner);
  getRelation(w, 1, 2);
  w.relations[0].allied = true;
  w.relations[0].war = false;
  const r = w.relations[0],
    colors = politicalColors(w);
  expect(colors.get(r.a)).toBe(colors.get(r.b));
  expect(w.nations.map((n) => n.color)).toEqual(identities);
  expect(w.tiles.map((t) => t.owner)).toEqual(owners);
  w.relations.forEach((r) => (r.allied = false));
  expect([...politicalColors(w).values()]).toEqual(identities);
});
it("paid construction progresses over years, restores exactly, changes land only at completion and preserves outer ocean", () => {
  const w = make(),
    n = w.nations[0],
    c = w.life!.settlements.find((c) => c.nation === n.id)!;
  const tile = w.tiles.findIndex(
    (t, i) =>
      t.t === 0 &&
      i % w.width > 4 &&
      i % w.width < w.width - 5 &&
      i > w.width * 4 &&
      i < w.tiles.length - w.width * 4,
  );
  w.year = 1;
  n.wealth = 500;
  w.living!.projects = [
    {
      id: 999,
      nation: n.id,
      city: c.id,
      tile,
      kind: "reclamation",
      started: 0,
      progress: 0,
      duration: 3,
      status: "building",
    },
  ];
  frontierYear(w);
  expect(w.tiles[tile].t).toBe(0);
  expect(n.wealth).toBe(499);
  const restored = JSON.parse(JSON.stringify(w));
  for (let k = 0; k < 2; k++) {
    frontierYear(w);
    frontierYear(restored);
  }
  expect(restored).toEqual(w);
  expect(w.tiles[tile].reclaimed).toBe(true);
  expect(w.tiles[tile].owner).toBe(n.id);
  expect(validate(w)).toBe(true);
  expect(w.tiles.slice(0, w.width).every((t) => t.t === 0)).toBe(true);
});
it("irrigation survives hydrology rebuilding and an occupied project is abandoned", () => {
  const w = make(),
    n = w.nations[0],
    c = w.life!.settlements.find((c) => c.nation === n.id)!;
  n.wealth = 100;
  w.year = 1;
  w.living!.projects = [
    {
      id: 999,
      nation: n.id,
      city: c.id,
      tile: c.tile,
      kind: "irrigation",
      started: 0,
      progress: 0,
      duration: 1,
      status: "building",
    },
  ];
  frontierYear(w);
  expect(w.tiles[c.tile].irrigated).toBe(true);
  expect(w.tiles[c.tile].fertility).toBeGreaterThanOrEqual(0.78);
  w.living!.projects[0].status = "building";
  w.tiles[c.tile].owner = 2;
  frontierYear(w);
  expect(w.living!.projects[0].status).toBe("abandoned");
});
it("an expedition creates its own city with only the passengers and cargo it carries; occupied shores cannot be colonised", () => {
  const w = make(),
    c = w.life!.settlements[0];
  const tile = w.tiles.findIndex(
    (t, i) =>
      t.t === 2 &&
      !t.owner &&
      !t.lake &&
      !t.river &&
      adjacent(w, i).some((j) => w.tiles[j].t === 0),
  );
  expect(tile).toBeGreaterThan(-1);
  const v: Vehicle = {
    id: 999,
    route: 0,
    mode: "sea",
    nation: c.nation,
    targetNation: c.nation,
    from: c.id,
    to: c.id,
    path: [0],
    progress: 0,
    previousProgress: 0,
    cargo: { food: 25, timber: 6 },
    people: [6, 16, 2],
    purpose: "colonize",
    targetTile: tile,
    strength: 0,
    returning: false,
  };
  const before = w.life!.settlements.length;
  expect(w.tiles[tile].owner).toBe(0);
  expect(settleExpedition(w, v)).toBe(true);
  expect(w.life!.settlements.length).toBe(before + 1);
  const founded = w.life!.settlements.at(-1)!;
  expect(founded.urban!.cohorts).toEqual([6, 16, 2]);
  expect(founded.urban!.stock.food).toBe(25);
  expect(founded.urban!.stock.metal).toBe(0);
  expect(settleExpedition(w, v)).toBe(false);
});
