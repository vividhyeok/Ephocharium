import { prepareArchive } from "./archives";
import { record, type World, type Nation } from "./engine";
import { prepareLife, type Settlement } from "./civilization";
import { eraOf, ERAS, housingCapacity } from "./eras";
import { buildGeography, adjacent, hash } from "./geography";
import { prepareCulture } from "./culture";
import {
  emptyStock,
  MATERIALS,
  type Material,
  type CityData,
} from "./livingTypes";
import {
  stockNation,
  manufacturing,
  extract,
  consumeNation,
} from "./resources";
import { demographicYear, emptyDemography, sum } from "./demographics";
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function createCity(w: World, c: Settlement) {
  if (c.urban) return;
  const n = w.nations[c.nation - 1],
    stock = emptyStock(),
    cities = w.life!.settlements.filter((x) => x.nation === n.id),
    p = w.life!.polities.find((p) => p.nation === n.id);
  const established =
    c.population <= 0 && cities.some((x) => x.id !== c.id && x.urban);
  stock.food = established ? 0 : n.food / Math.max(1, cities.length);
  stock.timber = (p?.wood || 15) / Math.max(1, cities.length);
  stock.metal = (p?.metal || 5) / Math.max(1, cities.length);
  stock.stone = established ? 0 : 4;
  stock.clay = established ? 0 : 4;
  if (established) stock.timber = stock.metal = 0;
  const pop =
    c.population ||
    (cities.some((x) => x.id !== c.id && x.urban) ? 0 : n.population);
  c.urban = {
    stock,
    cohorts: [pop * 0.32, pop * 0.6, pop * 0.08],
    roles: [c.tile === n.capital ? "capital" : "farm"],
    capacity: pop * 1.2,
    pressure: 0,
    water: 0.5,
    sanitation: 0.1,
    medicine: 0.05,
    education: 0.05,
    pollution: 0,
    damage: 0,
    port: 0,
    portTile: -1,
    station: 0,
    logistics: 0.1,
    temple: 0,
    mined: 0,
    produced: 0,
    imported: 0,
    exported: 0,
    growth: 0,
    births: 0,
    deaths: 0,
    lifeExpectancy: 35,
    fertility: 5,
    builtEra: Math.min(eraOf(n), Math.floor(c.development)),
    legacyBuildings: Math.min(c.homes, 4),
    influence: [...(n.culture?.shares || [1, 0, 0, 0, 0])],
    causes: [],
  };
}
export function ensureLiving(w: World, newTerrain = false) {
  prepareLife(w);
  if (!w.living) {
    w.living = {
      revision: 5,
      geographyRevision: 0,
      nextId: 1,
      routes: [],
      vehicles: [],
      monuments: [],
      trade: 0,
      migrants: 0,
      births: 0,
      deaths: 0,
      landRevision: 0,
      lastNetwork: -100,
      lostCargo: 0,
    };
    buildGeography(w, newTerrain);
  }
  for (const n of w.nations) {
    prepareCulture(w, n, true);
    n.demography ??= emptyDemography();
  }
  for (const c of w.life!.settlements) createCity(w, c);
  prepareArchive(w);
}
export function reconcileLiving(w: World) {
  if (!w.living || !w.life) return;
  for (const n of w.nations.filter((n) => n.alive)) {
    const cities = w.life.settlements.filter((c) => c.nation === n.id);
    for (const c of cities) createCity(w, c);
    const transit = w.living.vehicles
      .filter((v) => v.nation === n.id && v.people)
      .reduce((s, v) => s + sum(v.people!), 0);
    const total =
      cities.reduce((s, c) => s + sum(c.urban!.cohorts), 0) + transit;
    const difference = n.population - total;
    if (cities.length && Math.abs(difference) > 0.001) {
      if (total > 0) {
        const scale = Math.max(
          0,
          (n.population - transit) / Math.max(1, total - transit),
        );
        for (const c of cities)
          c.urban!.cohorts = c.urban!.cohorts.map((v) => v * scale) as [
            number,
            number,
            number,
          ];
      } else
        cities[0].urban!.cohorts = [
          difference * 0.32,
          difference * 0.6,
          difference * 0.08,
        ];
    }
    const food = cities.reduce((s, c) => s + c.urban!.stock.food, 0);
    if (cities.length && Math.abs(n.food - food) > 0.01) {
      const ratio = n.food / Math.max(1, food);
      if (food > 0) for (const c of cities) c.urban!.stock.food *= ratio;
      else cities[0].urban!.stock.food = n.food;
    }
    stockNation(w, n);
  }
}
interface Zone {
  cells: number[];
  farms: number;
  water: number;
  deposits: Partial<Record<Material, number[]>>;
  forest: number[];
}
const zones = new WeakMap<
  World,
  { key: string; year: number; data: Map<number, Zone> }
>();
function cityZones(w: World, owned: Map<number, number[]>) {
  const key =
    w
      .life!.settlements.map((c) => c.id + ":" + c.nation + ":" + c.tile)
      .join("|") +
    ":" +
    w.living!.landRevision;
  let cache = zones.get(w);
  if (cache && cache.key === key && w.year === cache.year) return cache.data;
  const data = new Map<number, Zone>();
  for (const c of w.life!.settlements)
    data.set(c.id, { cells: [], farms: 0, water: 0, deposits: {}, forest: [] });
  for (const [id, tiles] of owned) {
    const cities = w.life!.settlements.filter((c) => c.nation === id);
    if (!cities.length) continue;
    for (const i of tiles) {
      const x = i % w.width,
        y = Math.floor(i / w.width);
      const c = cities.reduce((a, b) =>
        ((a.tile % w.width) - x) ** 2 +
          (Math.floor(a.tile / w.width) - y) ** 2 <
        ((b.tile % w.width) - x) ** 2 + (Math.floor(b.tile / w.width) - y) ** 2
          ? a
          : b,
      );
      const z = data.get(c.id)!,
        t = w.tiles[i];
      z.cells.push(i);
      if (t.t !== 4 && t.t !== 5 && !t.lake)
        z.farms += t.fertility * (t.biome === "arid" ? 0.55 : 1);
      if (t.river || t.lake) z.water++;
      if (t.t === 3) z.forest.push(i);
      for (const k of MATERIALS)
        if ((t.deposits?.[k] || 0) > 0) {
          z.deposits[k] ??= [];
          z.deposits[k]!.push(i);
        }
    }
  }
  zones.set(w, { key, year: w.year, data });
  return data;
}
export function urbanYear(w: World, owned: Map<number, number[]>) {
  ensureLiving(w);
  reconcileLiving(w);
  const context = cityZones(w, owned);
  w.living!.births = 0;
  w.living!.deaths = 0;
  for (const n of w.nations.filter((n) => n.alive)) {
    const e = eraOf(n),
      cities = w.life!.settlements.filter((c) => c.nation === n.id),
      war = w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id));
    n.demography = emptyDemography();
    let weightedLife = 0,
      weightedFertility = 0,
      weightedAdult = 0,
      generatedEnergy = 0;
    for (const c of cities) {
      const u = c.urban!,
        z = context.get(c.id);
      if (!z) continue;
      const before = sum(u.cohorts),
        labor = u.cohorts[1],
        t = w.tiles[c.tile],
        damage = Math.max(u.damage, t.damage);
      u.damage = damage;
      u.water = clamp(
        0.3 +
          Math.min(0.65, (z.water / Math.max(1, z.cells.length)) * 8) +
          (t.river ? 0.3 : 0) +
          (u.stock.clay > 0 ? 0.08 : 0),
      );
      const funded = n.wealth > 30 && n.stability > 0.3 && labor >= 8;
      u.sanitation = clamp(
        u.sanitation + (funded ? 0.002 : -0.003),
        0,
        Math.min(0.98, 0.2 + e * 0.06),
      );
      u.medicine = clamp(
        u.medicine + (funded ? 0.0015 : -0.002),
        0,
        Math.min(0.95, 0.08 + e * 0.07),
      );
      u.education = clamp(
        u.education + (funded ? 0.0008 : -0.001),
        0,
        Math.min(0.95, 0.05 + e * 0.068),
      );
      u.pollution = clamp(
        (c.industry || 0) * 0.16 +
          (e >= 7 ? 0.12 : 0) -
          (e >= 11 ? 0.17 : 0) +
          damage * 0.3,
      );
      u.capacity =
        Math.max(
          24,
          Math.min(
            z.farms * (13 + Math.sqrt(n.tech) * 6) * ERAS[e].food +
              u.imported * 2,
            c.homes * housingCapacity(n) * 1.25 + z.farms * 2,
          ),
        ) *
        (0.65 + u.water * 0.35) *
        (1 - damage * 0.5);
      const agriculture =
        z.farms *
        (4 + Math.sqrt(n.tech) * 1.6) *
        ERAS[e].food *
        Math.min(1, labor / Math.max(5, z.farms * 0.6)) *
        (0.6 + u.water * 0.4) *
        (1 - damage);
      u.stock.food = Math.min(u.capacity * 1.5, u.stock.food + agriculture);
      u.produced = agriculture;
      u.mined = 0;
      for (const k of [
        "stone",
        "clay",
        "copper",
        "iron",
        "coal",
        "oil",
        "gold",
      ] as Material[]) {
        if (k === "oil" && e < 7) continue;
        const sites = z.deposits[k] || [];
        if (!sites.length) continue;
        for (let scan = 0; scan < Math.min(4, sites.length); scan++) {
          const i = sites[(w.year + c.id + scan) % sites.length];
          if (w.tiles[i].owner !== n.id) continue;
          const amount = extract(
            w.tiles[i],
            k,
            Math.min(2, labor * 0.008) *
              (1 + (c.industry || 0)) *
              (0.35 + u.logistics * 0.65) *
              (1 - damage),
          );
          u.stock[k] += amount;
          u.mined += amount;
          if (amount) break;
        }
      }
      if (z.forest.length) {
        const i = z.forest[(w.year + c.id) % z.forest.length];
        u.stock.timber += extract(
          w.tiles[i],
          "timber",
          Math.min(1, labor * 0.01) * (1 - damage),
        );
      }
      const made = manufacturing(u.stock, e, labor, u.logistics, n.wealth);
      u.produced += made.metal;
      const p = w.life!.polities.find((p) => p.nation === n.id)!;
      generatedEnergy += made.energy;
      u.roles = [
        ...(c.tile === n.capital ? ["capital" as const] : []),
        ...(z.farms > 10 ? ["farm" as const] : []),
        ...(u.mined > 0.2 ? ["mine" as const] : []),
        ...(made.metal > 0.1 ? ["industry" as const] : []),
        ...(u.port ? ["port" as const] : []),
        ...(u.temple > 1 ? ["faith" as const] : []),
        ...(e >= 6 && u.education > 0.4 ? ["research" as const] : []),
        ...(u.logistics > 0.65 ? ["junction" as const] : []),
      ];
      const plague = w.effects.some(
        (f) => f.kind === "plague" && Math.abs(f.tile - c.tile) < w.width * 4,
      )
        ? 1
        : 0;
      u.operation =
        Math.min(1, labor / Math.max(8, c.homes * 2 + e * 3)) * (1 - damage);
      u.neglect = clamp(
        (u.neglect || 0) + (u.operation < 0.2 ? 0.008 : -0.012),
      );
      if ((u.neglect || 0) > 0.6) {
        c.industry = Math.max(0, (c.industry || 0) - 0.015);
        c.network = Math.max(0, (c.network || 0) - 0.01);
        if (w.year % 20 === 0) {
          c.homes = Math.max(1, c.homes - 1);
          u.builtEra = Math.max(0, u.builtEra - 1);
        }
      }
      if (
        funded &&
        u.operation > 0.35 &&
        u.builtEra < Math.min(e, Math.floor(c.development)) &&
        u.stock.timber >= 0.5 &&
        (e < 7 || u.stock.metal >= 0.2)
      ) {
        u.stock.timber -= 0.5;
        if (e >= 7) u.stock.metal -= 0.2;
        n.wealth = Math.max(0, n.wealth - 2);
        u.builtEra++;
      }
      u.lifecycle =
        c.population < 1 || u.neglect > 0.85
          ? "ruin"
          : u.operation < 0.25 || u.neglect > 0.45
            ? "declining"
            : u.neglect > 0.1
              ? "recovering"
              : "active";
      const health = demographicYear(u, e, n.stability, war, plague);
      c.population = sum(u.cohorts);
      u.growth = c.population - before;
      w.living!.births += u.births;
      w.living!.deaths += u.deaths;
      n.demography.births += u.births;
      n.demography.deaths += u.deaths;
      n.demography.capacity += u.capacity;
      n.demography.pressure += u.pressure * c.population;
      weightedLife += u.lifeExpectancy * c.population;
      weightedFertility += u.fertility * c.population;
      weightedAdult += health.adultLongevity * c.population;
      for (let k = 0; k < 3; k++) n.demography.cohorts[k] += u.cohorts[k];
      n.wealth = Math.max(
        0,
        n.wealth +
          labor * 0.06 * ERAS[e].income * (1 - damage) +
          Math.min(u.stock.gold, 0.1) * 2 -
          z.cells.length * 0.025 -
          (funded ? 0.2 : 0),
      );
      u.stock.gold = Math.max(0, u.stock.gold - 0.02);
      n.stability = clamp(
        n.stability - u.pressure * 0.0004 - (war ? damage * 0.001 : 0),
        0.02,
        1,
      );
      if (
        damage > 0 &&
        funded &&
        u.stock.stone > 0.05 &&
        u.stock.timber > 0.05
      ) {
        u.stock.stone -= 0.05;
        u.stock.timber -= 0.05;
        u.damage = Math.max(0, damage - 0.006);
        t.damage = Math.max(0, t.damage - 0.006);
      }
      u.causes = [
        {
          key: "water",
          value: u.water,
          effect: agriculture,
          label: "수자원·경작지의 식량 생산",
        },
        {
          key: "mining",
          value: u.mined,
          effect: made.metal,
          label: "현장 채굴 → 금속 가공",
        },
        {
          key: "logistics",
          value: u.logistics,
          effect: u.imported,
          label: "운송망 → 실제 도착 화물",
        },
        {
          key: "pressure",
          value: u.pressure,
          effect: u.growth,
          label: "수용력 대비 인구 → 성장·이주 압력",
        },
        {
          key: "war",
          value: damage,
          effect:
            damage < 1
              ? (agriculture * damage) / (1 - damage)
              : z.farms *
                (4 + Math.sqrt(n.tech) * 1.6) *
                ERAS[e].food *
                Math.min(1, labor / Math.max(5, z.farms * 0.6)) *
                (0.6 + u.water * 0.4),
          label: "재해·전쟁 피해 → 생산 손실",
        },
      ];
    }
    const polity = w.life!.polities.find((p) => p.nation === n.id)!;
    polity.energy = Math.max(
      0,
      (polity.energy || 0) * 0.97 + generatedEnergy * 0.05,
    );
    const transit = w
      .living!.vehicles.filter((v) => v.nation === n.id && v.people)
      .reduce((a, v) => a + sum(v.people!), 0);
    n.population = sum(n.demography.cohorts) + transit;
    n.demography.total = n.population;
    n.demography.lifeExpectancy =
      weightedLife / Math.max(1, n.population - transit);
    n.demography.adultLongevity =
      weightedAdult / Math.max(1, n.population - transit);
    n.demography.fertility =
      weightedFertility / Math.max(1, n.population - transit);
    n.demography.pressure /= Math.max(1, n.population);
    n.demography.birthRate =
      (n.demography.births / Math.max(1, n.population)) * 1000;
    n.demography.deathRate =
      (n.demography.deaths / Math.max(1, n.population)) * 1000;
    stockNation(w, n);
    n.food = n.inventory!.food;
  }
  // Flooding depends on wet catchments and discharge; no timed disaster script.
  if (w.year % 17 === 0)
    for (const c of w.life!.settlements) {
      const t = w.tiles[c.tile];
      if (
        (t.river || 0) > 1.1 &&
        t.moisture! > 0.65 &&
        hash(w.seed, c.id, w.year) > 0.93
      ) {
        c.urban!.damage = Math.min(0.8, c.urban!.damage + 0.15);
        record(w, c.name + " 하천 범람과 농지 피해", [c.nation], c.tile);
      }
    }
}
export function preserveFounder(w: World, n: Nation) {
  if (
    !w.living ||
    w.living.monuments.some((m) => m.nation === n.id && m.kind === "founding")
  )
    return;
  w.living.monuments.push({
    id: w.living.nextId++,
    tile: n.capital,
    nation: n.id,
    culture: n.culture!.id,
    faith: n.culture!.faith,
    kind: "founding",
    year: w.year,
    condition: 1,
    reason: "현재 관측 시점의 건국 공동체 표지",
  });
}
