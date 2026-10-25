import { it, expect } from "vitest";
import { generate, validate, apply } from "./engine";
import { upgradeWorld } from "./cartography";
import { nationName } from "./identity";
import { getRelation, treaty, updateDiplomacy } from "./diplomacy";
const make = () =>
  generate({
    seed: 42,
    preset: "four",
    size: 112,
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
it("large worlds have ocean on every edge and irregular snow remains inland", () => {
  const w = generate({
    seed: 42,
    preset: "empty",
    size: 256,
    sea: 0.1,
    forest: 0.35,
    mountains: 0.05,
  });
  expect(w.width).toBe(256);
  expect(validate(w)).toBe(true);
  expect(
    w.tiles.every((t, i) =>
      i % w.width === 0 ||
      i % w.width === w.width - 1 ||
      i < w.width ||
      i >= w.tiles.length - w.width
        ? t.t === 0
        : true,
    ),
  ).toBe(true);
  expect(w.tiles.some((t) => t.t === 5)).toBe(true);
  expect(
    Array.from({ length: w.height }, (_, y) =>
      w.tiles.slice(y * w.width, (y + 1) * w.width).every((t) => t.t === 5),
    ).some(Boolean),
  ).toBe(false);
});
it("legacy sea padding preserves people, paths, population, seed and dates exactly once", () => {
  const w = make();
  delete w.cartographyRevision;
  delete w.identityRevision;
  const old = structuredClone(w),
    u = w.life!.citizens[0];
  const position = { x: u.x, y: u.y, route: [...u.route] };
  upgradeWorld(w);
  const margin = (w.width - old.width) / 2;
  expect(w.rng).toBe(old.rng);
  expect(w.year).toBe(old.year);
  expect(w.nations.map((n) => n.population)).toEqual(
    old.nations.map((n) => n.population),
  );
  expect(u.x).toBe(position.x + margin);
  expect(u.y).toBe(position.y + margin);
  expect(u.route).toEqual(
    position.route.map(
      (i) =>
        (Math.floor(i / old.width) + margin) * w.width +
        (i % old.width) +
        margin,
    ),
  );
  expect(w.tiles[0].t).toBe(0);
  expect(validate(w)).toBe(true);
  const once = structuredClone(w);
  upgradeWorld(w);
  expect(w).toEqual(once);
});
it("independent nations receive individual names instead of numbered dynasties", () => {
  const names = Array.from({ length: 2000 }, (_, i) => nationName(i + 1));
  expect(new Set(names).size).toBe(names.length);
  expect(names.some((n) => /\d+세/.test(n))).toBe(false);
});
it("treaties have dated causes and real alliance exchange; interventions select a nearby country", () => {
  const w = make(),
    r = getRelation(w, 1, 2);
  treaty(w, r, "alliance", "교역 협정");
  expect(r.allied).toBe(true);
  const food = w.nations[0].food;
  const wealth = w.nations[0].wealth;
  updateDiplomacy(w);
  expect(w.nations[0].food).toBe(food); // A defense pact must not generate grain.
  expect(w.nations[0].wealth).toBeGreaterThan(wealth);
  treaty(w, r, "war", "영토 분쟁", 1);
  expect(r.allied).toBe(false);
  expect(r.war).toBe(true);
  treaty(w, r, "peace", "전쟁 피로");
  expect(r.war).toBe(false);
  expect(w.diplomacyLog!.map((e) => e.kind)).toEqual([
    "alliance",
    "break",
    "war",
    "peace",
  ]);
  expect(validate(w)).toBe(true);
  expect(w.diplomacyLog!.at(-1)?.reason).toBe("전쟁 피로");
  apply(w, "alliance", w.nations[0].capital);
  expect(w.relations.some((r) => r.allied && (r.a === 1 || r.b === 1))).toBe(
    true,
  );
});
it("an ally joins defense only when it has an actual front with the attacker", () => {
  const w = make();
  for (const t of w.tiles) t.owner = 0;
  treaty(w, getRelation(w, 1, 2), "alliance", "상호 방위 조약");
  treaty(w, getRelation(w, 2, 3), "war", "침공", 3);
  updateDiplomacy(w);
  expect(getRelation(w, 1, 3).war).toBe(false);
  const tile = w.width * 20 + 20;
  w.tiles[tile].owner = 1;
  w.tiles[tile + 1].owner = 3;
  updateDiplomacy(w);
  expect(getRelation(w, 1, 3).war).toBe(true);
  expect(w.diplomacyLog!.at(-1)?.reason).toContain("상호 방위");
});
