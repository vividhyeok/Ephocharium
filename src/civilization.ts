import { culturalName } from './culture';
import { supplyFactor, populationLoss } from "./militaryLogistics";
import type { CityData } from "./livingTypes";
import { consumeNation, creditNation, extract } from "./resources";
import { random, neighbors, record, type World, type Nation } from "./engine";

export { ERAS, eraOf, housingCapacity } from "./eras";
import { ERAS, eraOf, housingCapacity } from "./eras";
export { researchRate } from "./progression";
export type Role =
  | "farmer"
  | "woodcutter"
  | "miner"
  | "builder"
  | "merchant"
  | "resident"
  | "ruler";
export const ROLES: Record<Role, string> = {
  farmer: "농부",
  woodcutter: "벌목꾼",
  miner: "광부",
  builder: "건축가",
  merchant: "상인",
  resident: "주민",
  ruler: "지도자",
};
export interface Citizen {
  id: number;
  nation: number;
  home: number;
  name: string;
  role: Role;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  route: number[];
  goal: number;
  work: number;
  returning: boolean;
}
export interface Settlement {
  id: number;
  nation: number;
  tile: number;
  name: string;
  population: number;
  level: number;
  homes: number;
  development: number;
  airport: boolean;
  urban?: CityData;
  industry?: number;
  network?: number;
}
export interface Polity {
  nation: number;
  era: number;
  regime: "tribe" | "monarchy" | "republic" | "vacuum";
  authority: number;
  energy?: number;
  satellites?: number;
  probes?: number;
  wood: number;
  metal: number;
}
export interface Army {
  id: number;
  nation: number;
  enemy: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  route: number[];
  target: number;
  strength: number;
  siege: number;
  fighting: boolean;
}
export interface Flight {
  id: number;
  nation: number;
  from: number;
  to: number;
  progress: number;
  previousProgress: number;
  cargo: number;
}
export interface LifeState {
  revision: 1;
  nextId: number;
  peoplePerAgent: number;
  citizens: Citizen[];
  settlements: Settlement[];
  polities: Polity[];
  armies: Army[];
  flights: Flight[];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const canWalk = (w: World, i: number) =>
  !!w.tiles[i] &&
  !w.tiles[i].lake &&
  ((w.tiles[i].river || 0) <= 1.5 || !!w.tiles[i].bridge) &&
  ![0, 4, 5].includes(w.tiles[i].t);
const point = (w: World, tile: number) => ({
  x: (tile % w.width) + 0.5,
  y: Math.floor(tile / w.width) + 0.5,
});
const index = (w: World, x: number, y: number) =>
  Math.floor(y) * w.width + Math.floor(x);
const distance = (w: World, a: number, b: number) =>
  Math.hypot(
    (a % w.width) - (b % w.width),
    Math.floor(a / w.width) - Math.floor(b / w.width),
  );
export function findRoute(
  w: World,
  start: number,
  end: number,
  nation?: number,
): number[] {
  if (start === end || !canWalk(w, end)) return [];
  const queue = [start],
    parents = new Map<number, number>([[start, -1]]);
  let cursor = 0;
  while (cursor < queue.length && cursor < 1800) {
    const i = queue[cursor++];
    for (const j of neighbors(w, i)) {
      if (
        parents.has(j) ||
        !canWalk(w, j) ||
        (nation !== undefined && w.tiles[j].owner !== nation)
      )
        continue;
      parents.set(j, i);
      if (j === end) {
        const path: number[] = [];
        let k = j;
        while (k !== start) {
          path.push(k);
          k = parents.get(k)!;
        }
        return path.reverse();
      }
      queue.push(j);
    }
  }
  return [];
}
function move(
  w: World,
  u: {
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    route: number[];
  },
  speed: number,
) {
  u.previousX = u.x;
  u.previousY = u.y;
  let remaining = speed;
  while (remaining > 0 && u.route.length) {
    const next = u.route[0];
    if (!canWalk(w, next)) {
      u.route = [];
      break;
    }
    const target = point(w, next),
      d = Math.hypot(target.x - u.x, target.y - u.y);
    if (d <= remaining) {
      u.x = target.x;
      u.y = target.y;
      u.route.shift();
      remaining -= d;
    } else {
      u.x += ((target.x - u.x) / d) * remaining;
      u.y += ((target.y - u.y) / d) * remaining;
      remaining = 0;
    }
  }
}
export function prepareLife(w: World) {
  if (!w.life) {
    w.life = {
      revision: 1,
      nextId: 1,
      peoplePerAgent: 5,
      citizens: [],
      settlements: [],
      polities: [],
      armies: [],
      flights: [],
    };
    for (const t of w.tiles) {
      t.wood = t.wood ?? (t.t === 3 ? 50 + t.ore * 60 : 0);
      t.mineral = t.mineral ?? (t.ore > 0.73 ? 40 + t.ore * 150 : 0);
      t.road = t.road ?? 0;
    }
  }
  const s = w.life;
  for (const n of w.nations.filter((n) => n.alive)) {
    if (!s.polities.some((p) => p.nation === n.id))
      s.polities.push({
        nation: n.id,
        era: eraOf(n),
        regime:
          eraOf(n) === 0
            ? "tribe"
            : eraOf(n) >= 7 && n.aggression < 0.55
              ? "republic"
              : "monarchy",
        authority: n.stability,
        wood: 15,
        metal: 5,
      });
    if (!s.settlements.some((c) => c.nation === n.id))
      s.settlements.push({
        id: s.nextId++,
        nation: n.id,
        tile: n.capital,
        name: n.name.replace(" 왕국", "") + " 수도",
        population: n.population,
        level: 0,
        homes: 2,
        development: eraOf(n),
        airport: false,
      });
  }
  return s;
}
function syncCitizens(w: World, owned: Map<number, number[]>) {
  const s = prepareLife(w),
    living = w.nations.filter((n) => n.alive);
  const pop = living.reduce((a, n) => a + n.population, 0);
  s.peoplePerAgent = Math.max(5, Math.ceil(pop / 900));
  s.settlements = s.settlements.filter((c) => w.nations[c.nation - 1]?.alive);
  for (const c of s.settlements) {
    if (
      w.living &&
      w.tiles[c.tile].owner &&
      w.tiles[c.tile].owner !== c.nation
    ) {
      c.nation = w.tiles[c.tile].owner;
      if (c.urban) c.urban.damage = Math.min(1, c.urban.damage + 0.3);
    }
    if (w.tiles[c.tile].owner !== c.nation) {
      const next = (owned.get(c.nation) || [])[0];
      if (next !== undefined) c.tile = next;
    }
  }
  const citizenMap = new Map<number, Citizen[]>();
  for (const c of s.citizens) {
    if (!citizenMap.has(c.nation)) citizenMap.set(c.nation, []);
    citizenMap.get(c.nation)!.push(c);
  }
  const result: Citizen[] = [];
  for (const n of living) {
    const cities = s.settlements.filter((c) => c.nation === n.id);
    if (!cities.length) continue;
    const count = Math.min(
        110,
        Math.max(1, Math.round(n.population / s.peoplePerAgent)),
      ),
      existing = (citizenMap.get(n.id) || []).slice(0, count);
    for (let i = existing.length; i < count; i++) {
      const home = cities[i % cities.length],
        p = point(w, home.tile),
        id = s.nextId++;
      existing.push({
        id,
        nation: n.id,
        home: home.id,
        name:
          i === 0
            ? n.leader
            : ["민서", "도윤", "서아", "지후", "하린", "이솔", "유진", "시온"][
                id % 8
              ],
        role:
          i === 0
            ? "ruler"
            : (
                [
                  "farmer",
                  "farmer",
                  "woodcutter",
                  "miner",
                  "builder",
                  "merchant",
                  "resident",
                ] as Role[]
              )[i % 7],
        x: p.x + ((id % 3) - 1) * 0.16,
        y: p.y + ((Math.floor(id / 3) % 3) - 1) * 0.14,
        previousX: p.x,
        previousY: p.y,
        route: [],
        goal: home.tile,
        work: 0,
        returning: true,
      });
    }
    if (existing[0]) {
      existing[0].role =
        s.polities.find((p) => p.nation === n.id)?.regime === "vacuum"
          ? "resident"
          : "ruler";
      existing[0].name = n.leader;
    }
    result.push(...existing);
  }
  s.citizens = result.slice(0, 1800);
  s.peoplePerAgent = Math.max(
    5,
    Math.round(pop / Math.max(1, s.citizens.length)),
  );
}
export function refreshLife(w: World) {
  const owned = new Map<number, number[]>();
  w.tiles.forEach((t, i) => {
    if (t.owner) {
      if (!owned.has(t.owner)) owned.set(t.owner, []);
      owned.get(t.owner)!.push(i);
    }
  });
  syncCitizens(w, owned);
  w.life!.armies = w.life!.armies.filter((a) =>
    w.relations.some(
      (r) =>
        r.war &&
        ((r.a === a.nation && r.b === a.enemy) ||
          (r.a === a.enemy && r.b === a.nation)),
    ),
  );
}
export function updateLife(w: World, owned: Map<number, number[]>) {
  const s = prepareLife(w);
  syncCitizens(w, owned);
  const contexts = new Map<
    number,
    {
      cells: number[];
      farms: number[];
      woods: number[];
      mines: number[];
      cities: Settlement[];
      polity: Polity;
    }
  >();
  for (const n of w.nations.filter((n) => n.alive)) {
    const cells = (owned.get(n.id) || []).filter(
      (i) => w.tiles[i].owner === n.id,
    );
    if (!cells.length) continue;
    const polity = s.polities.find((p) => p.nation === n.id)!,
      era = eraOf(n),
      cities = s.settlements.filter((c) => c.nation === n.id);
    if (era !== polity.era) {
      record(
        w,
        n.name + "이 " + ERAS[era].name + (era<polity.era?" 수준으로 쇠퇴했습니다":"에 진입했습니다"),
        [n.id],
        n.capital,
      );
      polity.era = era;
    }
    const regime =
      (polity.regime === "vacuum" && n.stability < 0.35) || n.stability < 0.12
        ? "vacuum"
        : era === 0
          ? "tribe"
          : era >= 7 && n.aggression < 0.55
            ? "republic"
            : "monarchy";
    if (regime !== polity.regime) {
      record(
        w,
        n.name +
          "의 정치 체제 변화 · " +
          {
            vacuum: "권력 공백",
            tribe: "부족 의회",
            monarchy: "군주정",
            republic: "공화정",
          }[regime],
        [n.id],
        n.capital,
      );
      polity.regime = regime;
    }
    polity.authority = clamp(
      n.stability * 0.75 +
        Math.min(0.25, n.wealth / Math.max(100, n.population * 12)) -
        (regime === "vacuum" ? 0.2 : 0),
      0,
      1,
    );
    const considerExpansion =
      n.population > cities.length * 120 &&
      n.wealth > 65 &&
      polity.wood > 8 &&
      cities.length < 12 &&
      (w.year + n.id) % 4 === 0;
    const far = considerExpansion
      ? cells.reduce(
          (best, i) => {
            const d = Math.min(...cities.map((c) => distance(w, i, c.tile)));
            return d > best.d ? { tile: i, d } : best;
          },
          { tile: n.capital, d: 0 },
        )
      : { tile: n.capital, d: 0 };
    if (
      n.population > cities.length * 120 &&
      n.wealth > 65 &&
      polity.wood > 8 &&
      far.d > 5 &&
      cities.length < 12
    ) {
      const c: Settlement = {
        id: s.nextId++,
        nation: n.id,
        tile: far.tile,
        name: culturalName(n.culture?.id || 0, w.seed + w.life!.nextId) + "시",
        population: 0,
        level: 0,
        homes: 2,
        development: 0,
        airport: false,
      };
      cities.push(c);
      s.settlements.push(c);
      n.wealth -= 40;
      polity.wood -= 8;
      record(w, c.name + " 정착지 건설", [n.id], c.tile);
    }
    const airports: Settlement[] = [];
    for (const c of cities) {
      if (!w.living) c.population = n.population / cities.length;
      c.development = clamp(
        c.development +
          ((c.urban?.operation??1)>.3 && n.food > n.population ? 0.04 : -0.03) +
          ((c.urban?.operation??1)>.3?Math.min(0.05, n.wealth / 10000):0),
        0,
        era + 1 + Math.log1p(Math.max(0, n.tech - 300)),
      );
      const previousLevel = c.level;
      c.level = Math.min(
        era,
        c.population > 500
          ? 4
          : c.population > 150
            ? 3
            : c.population > 55
              ? 2
              : c.population > 25
                ? 1
                : 0,
      );
      if (c.level > previousLevel)
        record(w, c.name + " 도시 발전 · 단계 " + c.level, [n.id], c.tile);
      const desiredHomes = clamp(
        Math.ceil(c.population / housingCapacity(n)),
        2,
        18,
      );
      if (
        c.homes < desiredHomes &&
        polity.wood >= 2 &&
        (era < 7 || polity.metal >= 1)
      ) {
        if (w.living && !consumeNation(w, n, "timber", 2)) continue;
        if (w.living && era >= 7 && !consumeNation(w, n, "metal", 1)) continue;
        c.homes++;
        polity.wood -= 2;
        if (era >= 7) polity.metal -= 1;
      }
      if (c.homes > desiredHomes) c.homes = desiredHomes;
      c.airport =
        era >= 9 &&
        c.population >= 60 &&
        n.wealth > 100 &&
        c.development >= 9 &&
        airports.length < 3 &&
        !airports.some((other) => distance(w, other.tile, c.tile) < 8);
      if (c.airport) airports.push(c);
      if (w.tiles[c.tile].t === 3) {
        polity.wood += (w.tiles[c.tile].wood || 0) * 0.1;
        w.tiles[c.tile].wood = 0;
        w.tiles[c.tile].t = 2;
      }
      if (c.tile === n.capital) c.name = n.name.replace(" 왕국", "") + " 수도";
    }
    polity.wood = Math.max(0, polity.wood - cities.length * 0.025);
    polity.metal = Math.max(
      0,
      polity.metal - cities.length * (era >= 7 ? 0.06 : 0.01),
    );
    const housing = cities.reduce(
      (total, c) => total + c.homes * housingCapacity(n),
      0,
    );
    n.stability = Math.max(
      0.02,
      n.stability -
        Math.min(
          0.012,
          Math.max(0, n.population / Math.max(1, housing) - 1) * 0.001,
        ),
    );
    contexts.set(n.id, {
      cells,
      farms: cells.filter(
        (i) => w.tiles[i].t === 2 && w.tiles[i].fertility > 0.55,
      ),
      woods: cells.filter(
        (i) => w.tiles[i].t === 3 && (w.tiles[i].wood || 0) > 2,
      ),
      mines: cells.filter((i) => (w.tiles[i].mineral || 0) > 1),
      cities,
      polity,
    });
  }
  // Stored positions and routes drive rendering; no per-frame decorative displacement.
  for (const u of s.citizens) {
    const n = w.nations[u.nation - 1],
      ctx = contexts.get(u.nation);
    if (!ctx) continue;
    const home = ctx.cities.find((c) => c.id === u.home) || ctx.cities[0];
    u.home = home.id;
    if (u.role === "ruler") {
      u.name = n.leader;
      if (ctx.polity.regime === "vacuum") {
        u.role = "resident";
      }
    }
    const tile = index(w, u.x, u.y);
    if (!w.tiles[tile] || w.tiles[tile].owner !== u.nation) {
      const p = point(w, home.tile);
      u.x = p.x;
      u.y = p.y;
      u.route = [];
    }
    if (u.route.some((i) => w.tiles[i].owner !== u.nation)) u.route = [];
    if (!u.route.length) {
      if (u.work > 0) {
        u.work--;
        const t = w.tiles[u.goal];
        if (!u.returning && t && t.owner === u.nation) {
          if (u.role === "farmer") n.food += 0.55 * (1 - t.damage);
          if (u.role === "woodcutter" && (t.wood || 0) > 0) {
            t.wood = Math.max(0, (t.wood || 0) - 0.8);
            ctx.polity.wood += 0.8;
            if (w.living) creditNation(w, n, "timber", 0.8);
            n.wealth += 0.15;
          }
          if (u.role === "miner" && (t.mineral || 0) > 0) {
            t.mineral = Math.max(0, (t.mineral || 0) - 0.5);
            ctx.polity.metal += 0.5;
            if (w.living) {
              const kind =
                t.deposits &&
                Object.keys(t.deposits).find(
                  (k) => (t.deposits![k as keyof typeof t.deposits] || 0) > 0,
                );
              if (kind) {
                t.mine = kind as any;
                creditNation(w, n, kind as any, extract(t, kind as any, 0.5));
              }
            }
            n.wealth += 0.35;
          }
          if (u.role === "builder") {
            home.development = Math.min(
              eraOf(n) + 1 + Math.log1p(Math.max(0, n.tech - 300)),
              home.development + 0.015,
            );
            t.damage = Math.max(0, t.damage - 0.02);
          }
          if (u.role === "merchant") {
            n.wealth += 0.2;
            // Knowledge diffusion is handled by bilateral relations, not decorative movement.
          }
        }
      } else {
        u.returning = !u.returning;
        let goals = u.returning
          ? [home.tile]
          : u.role === "farmer"
            ? ctx.farms
            : u.role === "woodcutter"
              ? ctx.woods
              : u.role === "miner"
                ? ctx.mines
                : u.role === "merchant"
                  ? ctx.cities.map((c) => c.tile)
                  : ctx.cells;
        if (!goals.length) goals = [home.tile];
        const start = index(w, u.x, u.y);
        const sampled: number[] = [];
        const stride = Math.max(1, Math.ceil(goals.length / 32));
        for (let g = 0; g < goals.length; g += stride) sampled.push(goals[g]);
        const nearest = sampled
          .sort((a, b) => distance(w, start, a) - distance(w, start, b))
          .slice(0, 12);
        u.goal = nearest[Math.floor(random(w) * nearest.length)];
        u.route = findRoute(w, start, u.goal, u.nation);
        u.work = 2 + Math.floor(random(w) * 3);
      }
    }
    move(
      w,
      u,
      ERAS[eraOf(n)].mobility + (w.tiles[index(w, u.x, u.y)]?.road || 0) * 0.5,
    );
    const now = w.tiles[index(w, u.x, u.y)];
    if (now && u.route.length && eraOf(n) >= 1 && u.role === "merchant")
      now.road = Math.min(1, (now.road || 0) + 0.12);
  }
  // Woodland regrows slowly; mineral reserves are finite.
  for (const t of w.tiles)
    if (t.t === 3)
      t.wood = Math.min(110, (t.wood || 0) + 0.025 * (1 - t.damage));
  updateArmies(w, contexts);
  updateFlights(w);
  s.polities = s.polities.filter((p) => w.nations[p.nation - 1]?.alive);
}
function updateArmies(
  w: World,
  contexts: Map<
    number,
    { cells: number[]; cities: Settlement[]; polity: Polity }
  >,
) {
  const s = w.life!;
  s.armies = s.armies.filter(
    (a) =>
      w.nations[a.nation - 1]?.alive &&
      w.nations[a.enemy - 1]?.alive &&
      a.strength > 2 &&
      w.relations.some(
        (r) =>
          r.war &&
          ((r.a === a.nation && r.b === a.enemy) ||
            (r.b === a.nation && r.a === a.enemy)),
      ),
  );
  for (const r of w.relations.filter((r) => r.war))
    for (const [nation, enemy] of [
      [r.a, r.b],
      [r.b, r.a],
    ]) {
      const n = w.nations[nation - 1],
        ctx = contexts.get(nation);
      if (
        !n?.alive ||
        !ctx ||
        s.armies.some((a) => a.nation === nation && a.enemy === enemy) ||
        n.population < 25 ||
        s.armies.length >= 100
      )
        continue;
      const frontier = ctx.cells
        .flatMap((i) => neighbors(w, i))
        .filter((i) => w.tiles[i].owner === enemy && canWalk(w, i));
      if (!frontier.length) continue;
      const target = frontier[Math.floor(random(w) * frontier.length)],
        home = ctx.cities
          .slice()
          .sort(
            (a, b) => distance(w, a.tile, target) - distance(w, b.tile, target),
          )[0];
      const path = findRoute(w, home.tile, target);
      if (!path.length) continue;
      const p = point(w, home.tile);
      s.armies.push({
        id: s.nextId++,
        nation,
        enemy,
        x: p.x,
        y: p.y,
        previousX: p.x,
        previousY: p.y,
        route: path,
        target,
        strength: Math.min(220, n.population * 0.09),
        siege: 0,
        fighting: false,
      });
    }
  for (const a of s.armies) {
    const n = w.nations[a.nation - 1],
      enemy = w.nations[a.enemy - 1],
      ctx = contexts.get(n.id);
    if (!ctx) continue;
    a.fighting = false;
    n.food = Math.max(0, n.food - a.strength * 0.015);
    n.wealth = Math.max(0, n.wealth - a.strength * 0.008);
    if (
      !a.route.length &&
      (w.tiles[a.target]?.owner !== a.enemy || index(w, a.x, a.y) !== a.target)
    ) {
      const frontier = ctx.cells
        .flatMap((i) => neighbors(w, i))
        .filter((i) => w.tiles[i].owner === a.enemy && canWalk(w, i));
      if (!frontier.length) continue;
      a.target = frontier.reduce((best, i) =>
        distance(w, index(w, a.x, a.y), i) <
        distance(w, index(w, a.x, a.y), best)
          ? i
          : best,
      );
      a.route = findRoute(w, index(w, a.x, a.y), a.target);
      a.siege = 0;
    }
    move(w, a, eraOf(n) >= 7 ? 1.8 : 1.1);
    const tile = index(w, a.x, a.y);
    if (w.tiles[tile]?.owner !== a.enemy) continue;
    a.route = [];
    a.target = tile;
    a.fighting = true;
    const allied = s.armies
      .filter(
        (other) =>
          other.nation === a.enemy &&
          Math.hypot(other.x - a.x, other.y - a.y) < 2.5,
      )
      .reduce((total, other) => total + other.strength * 0.2, 0);
    const supply =
        (w.living ? supplyFactor(w, n, tile) : 1) /
        (1 + distance(w, n.capital, tile) / 40),
      terrain = w.tiles[tile].t === 3 ? 1.3 : 1;
    const attack =
        a.strength *
        (1 + Math.sqrt(n.tech) * 0.4) *
        (0.8 + (n.tendencies?.military || 0.2)) *
        (0.4 + ctx.polity.authority * 0.6) *
        supply *
        (n.airSupport &&
        n.airSupport.until >= w.year &&
        distance(w, n.airSupport.tile, tile) < 4
          ? 1.2
          : 1),
      defense =
        ((enemy.population / Math.max(1, enemy.territory)) * 1.8 + allied) *
        (1 + Math.sqrt(enemy.tech) * 0.38) *
        terrain;
    const loss = Math.min(
      a.strength,
      Math.max(0.2, defense * 0.03) * (0.7 + random(w) * 0.6),
    );
    a.strength -= loss;
    populationLoss(w, n, loss * 0.7);
    if (!enemy.protected)
      populationLoss(w, enemy, Math.max(0.1, attack * 0.018));
    a.siege += (attack / Math.max(1, attack + defense)) * 0.8;
    w.tiles[tile].damage = Math.min(0.8, w.tiles[tile].damage + 0.03);
    w.tiles[tile].road = Math.max(0, (w.tiles[tile].road || 0) - 0.04);
    w.tiles[tile].rail = Math.max(0, (w.tiles[tile].rail || 0) - 0.04);
    for (const city of s.settlements)
      if (city.urban && distance(w, city.tile, tile) < 2) {
        city.urban.damage = Math.min(1, city.urban.damage + 0.03);
        if (city.urban.damage > 0.4 && w.year % 4 === 0)
          city.homes = Math.max(1, city.homes - 1);
      }
    w.effects.push({ tile, kind: "전투", life: 2 });
    if (a.siege > 1.8 && a.strength > 3 && !enemy.protected) {
      w.tiles[tile].owner = n.id;
      a.siege = 0;
      record(
        w,
        n.name + " 군대가 " + enemy.name + "의 영토를 점령했습니다",
        [n.id, enemy.id],
        tile,
      );
    }
  }
}
function updateFlights(w: World) {
  const s = w.life!;
  const cities = new Map(s.settlements.map((c) => [c.id, c]));
  s.flights = s.flights.filter((f) => {
    const a = cities.get(f.from),
      b = cities.get(f.to);
    return (
      !!a && !!b && a.airport && b.airport && w.nations[f.nation - 1]?.alive
    );
  });
  for (const n of w.nations.filter(
    (n) => n.alive && eraOf(n) >= 9 && n.wealth > 100,
  )) {
    const airports = s.settlements.filter(
      (c) => c.nation === n.id && c.airport,
    );
    if (
      airports.length < 2 ||
      s.flights.some((f) => f.nation === n.id) ||
      s.flights.length >= 80
    )
      continue;
    const from = airports[0],
      to = airports[1 + Math.floor(random(w) * (airports.length - 1))];
    if (
      w.living &&
      (!from.urban ||
        from.urban.stock.food < 8 ||
        !consumeNation(w, n, "oil", 0.15))
    )
      continue;
    if (w.living) from.urban!.stock.food -= 8;
    n.wealth -= 3;
    s.flights.push({
      id: s.nextId++,
      nation: n.id,
      from: from.id,
      to: to.id,
      progress: 0,
      previousProgress: 0,
      cargo: 8,
    });
    if (
      !w.history.some(
        (e) => e.nations.includes(n.id) && e.text.includes("첫 항공로"),
      )
    )
      record(w, n.name + "의 첫 항공로 개통", [n.id], from.tile);
  }
  for (const f of s.flights) {
    const a = cities.get(f.from)!,
      b = cities.get(f.to)!;
    f.previousProgress = f.progress;
    f.progress += Math.min(
      0.2,
      1 / Math.max(6, distance(w, a.tile, b.tile) * 0.5),
    );
    if (f.progress >= 1) {
      const n = w.nations[f.nation - 1];
      if (w.living && b.urban) b.urban.stock.food += f.cargo;
      n.wealth += f.cargo * 0.2;
      const from = f.from;
      f.from = f.to;
      f.to = from;
      f.progress = 0;
      f.previousProgress = 0;
      n.wealth = Math.max(0, n.wealth - 3);
      if (w.living) {
        if (
          !b.urban ||
          b.urban.stock.food < 8 ||
          !consumeNation(w, n, "oil", 0.15)
        )
          f.cargo = 0;
        else {
          b.urban.stock.food -= 8;
          f.cargo = 8;
        }
      }
    }
    if (w.living) s.flights = s.flights.filter((f) => f.cargo > 0);
  }
}
export function validateLife(w: World): boolean {
  const s = w.life;
  if (s === undefined) return true;
  if (
    !s ||
    s.revision !== 1 ||
    !Number.isSafeInteger(s.nextId) ||
    s.nextId < 1 ||
    !Number.isFinite(s.peoplePerAgent) ||
    s.peoplePerAgent < 1
  )
    return false;
  const id = (id: number) =>
    Number.isInteger(id) && id > 0 && id <= w.nations.length;
  const tile = (i: number) =>
    Number.isInteger(i) && i >= 0 && i < w.tiles.length;
  const number = (n: number) => Number.isFinite(n) && n >= 0 && n < 1e12;
  const position = (a: {
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    route: number[];
  }) =>
    a &&
    number(a.x) &&
    a.x < w.width &&
    number(a.y) &&
    a.y < w.height &&
    number(a.previousX) &&
    a.previousX < w.width &&
    number(a.previousY) &&
    a.previousY < w.height &&
    Array.isArray(a.route) &&
    a.route.length <= w.tiles.length &&
    a.route.every(tile);
  return (
    Array.isArray(s.citizens) &&
    s.citizens.length <= 2000 &&
    s.citizens.every(
      (c) =>
        c &&
        id(c.nation) &&
        position(c) &&
        Number.isSafeInteger(c.id) &&
        typeof c.name === "string" &&
        c.name.length < 100 &&
        Object.hasOwn(ROLES, c.role) &&
        number(c.home) &&
        tile(c.goal) &&
        number(c.work) &&
        typeof c.returning === "boolean",
    ) &&
    Array.isArray(s.settlements) &&
    s.settlements.length <= 100000 &&
    s.settlements.every(
      (c) =>
        c &&
        id(c.nation) &&
        tile(c.tile) &&
        number(c.id) &&
        typeof c.name === "string" &&
        c.name.length < 200 &&
        number(c.population) &&
        number(c.level) &&
        c.level <= 13 &&
        number(c.homes) &&
        c.homes <= 18 &&
        number(c.development) &&
        typeof c.airport === "boolean" &&
        [c.industry, c.network].every((v) => v === undefined || number(v)),
    ) &&
    Array.isArray(s.polities) &&
    s.polities.length <= 100000 &&
    s.polities.every(
      (p) =>
        p &&
        id(p.nation) &&
        Number.isInteger(p.era) &&
        p.era >= 0 &&
        p.era < ERAS.length &&
        ["tribe", "monarchy", "republic", "vacuum"].includes(p.regime) &&
        number(p.authority) &&
        p.authority <= 1 &&
        number(p.wood) &&
        number(p.metal) &&
        [p.energy, p.satellites, p.probes].every(
          (v) => v === undefined || number(v),
        ),
    ) &&
    Array.isArray(s.armies) &&
    s.armies.length <= 100 &&
    s.armies.every(
      (a) =>
        a &&
        id(a.nation) &&
        id(a.enemy) &&
        position(a) &&
        tile(a.target) &&
        number(a.id) &&
        number(a.strength) &&
        number(a.siege) &&
        typeof a.fighting === "boolean",
    ) &&
    Array.isArray(s.flights) &&
    s.flights.length <= 80 &&
    s.flights.every(
      (f) =>
        f &&
        id(f.nation) &&
        s.settlements.some((c) => c.id === f.from) &&
        s.settlements.some((c) => c.id === f.to) &&
        number(f.progress) &&
        f.progress < 1 &&
        number(f.previousProgress) &&
        f.previousProgress < 1 &&
        number(f.cargo),
    )
  );
}
