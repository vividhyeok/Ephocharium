import { found, record, type World } from "./engine";
import { adjacent, isWater } from "./geography";
import { sum } from "./demographics";
import type { Cohorts } from "./livingTypes";
import { createCity } from "./living";
import { prepareLife } from "./civilization";
export interface Settler {
  tile: number;
  population: number;
  progress: number;
  parentId?: number;
  route?: number[];
  food?: number;
  cohorts?: Cohorts;
}
const habitable = (w: World, i: number) => {
  const t = w.tiles[i];
  return t && !isWater(t) && t.t !== 4 && t.t !== 5;
};
const distance = (w: World, a: number, b: number) =>
  Math.abs((a % w.width) - (b % w.width)) +
  Math.abs(Math.floor(a / w.width) - Math.floor(b / w.width));
export function seedHumanity(w: World) {
  const candidates = w.tiles
    .map((t, i) => (habitable(w, i) && t.fertility >= 0.4 ? i : -1))
    .filter((i) => i >= 0);
  const count = w.width >= 100 ? 7 : 5;
  for (let k = 0; k < count && candidates.length; k++) {
    const score = (i: number) =>
      w.tiles[i].fertility * 3 +
      Math.min(1, w.tiles[i].river || 0) * 0.5 +
      Math.min(3, ...w.settlers.map((s) => distance(w, i, s.tile) / 7));
    const available = candidates.filter((i) =>
      w.settlers.every(
        (s) => distance(w, i, s.tile) >= Math.max(5, Math.floor(w.width / 11)),
      ),
    );
    if (!available.length) break;
    const tile = available.reduce((a, b) => (score(b) > score(a) ? b : a));
    w.settlers.push({ tile, population: 42, progress: 1.9 - k * 0.12 });
  }
}
function scout(w: World, start: number, parent: number) {
  const queue = [start],
    prev = new Map([[start, -1]]),
    reserved = new Set(w.settlers.map((s) => s.route?.at(-1) ?? s.tile));
  let best = -1,
    bestScore = -Infinity;
  for (let p = 0; p < queue.length && p < 900; p++) {
    const i = queue[p],
      t = w.tiles[i],
      d = distance(w, start, i);
    if (
      d >= 5 &&
      !t.owner &&
      t.fertility >= 0.45 &&
      !reserved.has(i) &&
      w.nations.every((n) => !n.alive || distance(w, n.capital, i) >= 5)
    ) {
      const score =
        t.fertility * 2 +
        Math.min(1, t.river || 0) * 0.5 +
        Math.min(d, 12) * 0.055 -
        t.damage;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (d >= 15) continue;
    for (const j of adjacent(w, i)) {
      const t = w.tiles[j];
      if (
        !prev.has(j) &&
        habitable(w, j) &&
        (!t.owner || t.owner === parent) &&
        ((t.river || 0) <= 1.5 || t.bridge)
      ) {
        prev.set(j, i);
        queue.push(j);
      }
    }
  }
  if (best < 0) return [];
  const path = [];
  for (let i = best; i !== start; i = prev.get(i)!) path.push(i);
  return path.reverse();
}
export const foundingRules = {
  minimumPopulation: 95,
  minimumNationAge: 24,
  migrationCooldown: 80,
  maxParties: 12,
};
export const foundingNationCap = (w: World) => (w.preset === "dawn" ? 26 : 16);
export function launchSettlers(w: World) {
  if (
    w.preset === "empty" ||
    w.year % 8 !== 0 ||
    w.settlers.length >= foundingRules.maxParties
  )
    return;
  if (w.nations.filter((n) => n.alive).length >= foundingNationCap(w)) return;
  for (const n of w.nations) {
    if (
      !n.alive ||
      n.population < foundingRules.minimumPopulation ||
      w.year - (n.foundedYear ?? 0) < foundingRules.minimumNationAge ||
      w.year - (n.lastMigrationYear ?? -1000) <
        foundingRules.migrationCooldown ||
      w.settlers.some((s) => s.parentId === n.id)
    )
      continue;
    const home = w.life?.settlements
      .filter(
        (c) =>
          c.nation === n.id &&
          c.urban &&
          sum(c.urban.cohorts) >= 75 &&
          c.urban.stock.food >= 20,
      )
      .sort((a, b) => b.population - a.population)[0];
    if (!home?.urban) continue;
    const pressure =
      n.population / Math.max(1, n.demography?.capacity || n.population);
    if (
      w.preset !== "dawn" &&
      pressure < 0.85 &&
      n.strategy?.priority !== "agriculture"
    )
      continue;
    const route = scout(w, home.tile, n.id);
    if (!route.length) continue;
    const population = Math.min(
      36,
      Math.max(20, sum(home.urban.cohorts) * 0.17),
    );
    const food = Math.ceil(population * 0.04 * (route.length / 2 + 7));
    if (home.urban.stock.food < food + 10) continue;
    const cohorts = home.urban.cohorts.map(
      (v) => (v / sum(home.urban!.cohorts)) * population,
    ) as Cohorts;
    home.urban.cohorts = home.urban.cohorts.map(
      (v, i) => v - cohorts[i],
    ) as Cohorts;
    home.population = sum(home.urban.cohorts);
    home.urban.stock.food -= food;
    n.food = Math.max(0, n.food - food);
    if (n.inventory) n.inventory.food = Math.max(0, n.inventory.food - food);
    n.population = Math.max(0, n.population - population);
    n.lastMigrationYear = w.year;
    w.settlers.push({
      tile: home.tile,
      population,
      progress: 0,
      food,
      cohorts,
      parentId: n.id,
      route,
    });
    record(
      w,
      `${n.name}에서 ${Math.round(population)}명이 경작지와 정착지를 찾아 독립 이주를 시작했습니다`,
      [n.id],
      home.tile,
    );
    if (w.settlers.length >= foundingRules.maxParties) break;
  }
}
export function settleYear(w: World) {
  for (const s of [...w.settlers]) {
    const remove = () => w.settlers.splice(w.settlers.indexOf(s), 1);
    if (s.parentId) {
      const ration = s.population * 0.04;
      s.food = Math.max(0, (s.food || 0) - ration);
      if (!s.food && s.cohorts) {
        s.cohorts = s.cohorts.map((v) => v * 0.94) as Cohorts;
        s.population = sum(s.cohorts);
        if (s.population < 2) {
          record(
            w,
            "보급을 잃은 이주대가 정착에 실패했습니다",
            [s.parentId],
            s.tile,
          );
          remove();
          continue;
        }
      }
      if (s.route?.length) {
        for (let k = 0; k < 2 && s.route.length; k++) {
          const next = s.route[0];
          if (
            !habitable(w, next) ||
            (w.tiles[next].owner && w.tiles[next].owner !== s.parentId)
          ) {
            s.route = scout(w, s.tile, s.parentId);
            break;
          }
          s.tile = s.route.shift()!;
        }
        continue;
      }
      if (w.tiles[s.tile].owner) {
        s.route = scout(w, s.tile, s.parentId);
        continue;
      }
    }
    if (!habitable(w, s.tile) || w.tiles[s.tile].owner) {
      if (!s.parentId) remove();
      continue;
    }
    s.progress += w.tiles[s.tile].fertility;
    if (s.progress < 3) continue;
    const n = found(w, s.tile, s.population, s.parentId);
    if (!n) continue;
    if (s.parentId) {
      n.food = s.food || 0;
      n.wealth = 0;
      n.tech = Math.max(0.1, (w.nations[s.parentId - 1]?.tech || 0.1) * 0.7);
      prepareLife(w);
      const city = w.life!.settlements.find((c) => c.nation === n.id)!;
      createCity(w, city);
      if (s.cohorts) city.urban!.cohorts = s.cohorts;
      record(
        w,
        `${w.nations[s.parentId - 1].name}의 이주민이 ${n.name}을 독립 건국했습니다`,
        [s.parentId, n.id],
        s.tile,
      );
    } else
      record(
        w,
        `강과 농경지에 모인 사람들이 ${n.name}을 세웠습니다`,
        [n.id],
        s.tile,
      );
    remove();
  }
}
