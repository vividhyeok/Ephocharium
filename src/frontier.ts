import { record, type World } from "./engine";
import { adjacent, buildGeography, isWater } from "./geography";
import { eraOf } from "./eras";
import { consumeNation } from "./resources";
import { createCity } from "./living";
import { culturalName } from "./culture";
import { emptyStock, type Vehicle } from "./livingTypes";
import { transportPath } from "./transport";

export function settleExpedition(w: World, v: Vehicle) {
  const t = v.targetTile === undefined ? undefined : w.tiles[v.targetTile];
  if (
    !t ||
    isWater(t) ||
    t.owner ||
    !v.people ||
    !w.nations[v.nation - 1]?.alive
  )
    return false;
  const tile = v.targetTile!,
    id = w.life!.nextId++,
    n = w.nations[v.nation - 1];
  for (const j of [tile, ...adjacent(w, tile)])
    if (!isWater(w.tiles[j]) && !w.tiles[j].owner) w.tiles[j].owner = n.id;
  const c = {
    id,
    nation: n.id,
    tile,
    name: culturalName(n.culture?.id || 0, w.seed + id) + " 개척항",
    population: 0,
    level: 1,
    homes: 2,
    development: 1,
    airport: false,
  };
  w.life!.settlements.push(c);
  createCity(w, c);
  const city = w.life!.settlements.at(-1)!;
  city.urban!.cohorts = [...v.people];
  city.urban!.stock = { ...emptyStock(), ...v.cargo };
  city.population = v.people.reduce((a, b) => a + b, 0);
  city.urban!.port = 1;
  city.urban!.portTile = v.path.at(-1)!;
  w.living!.landRevision++;
  record(
    w,
    `${n.name}의 개척선이 도착해 ${city.name} 건설 · 이주민 ${Math.round(city.population)}명`,
    [n.id],
    tile,
  );
  return true;
}

export function frontierYear(w: World) {
  const s = w.living!;
  s.projects ??= [];
  let changed = false;
  for (const p of s.projects.filter((p) => p.status === "building")) {
    const n = w.nations[p.nation - 1],
      c = w.life!.settlements.find((c) => c.id === p.city),
      t = w.tiles[p.tile];
    if (
      !n?.alive ||
      !c?.urban ||
      c.nation !== p.nation ||
      (t.owner && t.owner !== p.nation)
    ) {
      p.status = "abandoned";
      continue;
    }
    if (c.urban.damage > 0.5 || n.wealth < 1) continue;
    n.wealth -= 1;
    p.progress++;
    if (p.progress < p.duration) continue;
    p.status = "complete";
    t.t = 2;
    t.owner = p.nation;
    t.lake = false;
    t.elevation = 0.18;
    t.baseFertility = t.fertility = p.kind === "irrigation" ? 0.78 : 0.62;
    if (p.kind === "irrigation") t.irrigated = true;
    else t.reclaimed = true;
    changed = true;
    record(
      w,
      `${n.name} ${p.kind === "irrigation" ? "사막 관개 농지" : "해안 간척지"} 준공`,
      [n.id],
      p.tile,
    );
  }
  if (changed) buildGeography(w);
  if (w.year % 48 !== 0) return;
  // Bounded persistent history; completed works remain represented on their tiles.
  s.projects = s.projects
    .filter((p) => p.status === "building" || w.year - p.started < 1200)
    .slice(-240);
  const land = new Int32Array(w.tiles.length);
  let region = 0;
  for (let i = 0; i < land.length; i++)
    if (!land[i] && !isWater(w.tiles[i])) {
      const queue = [i];
      land[i] = ++region;
      for (let k = 0; k < queue.length; k++)
        for (const j of adjacent(w, queue[k]))
          if (!land[j] && !isWater(w.tiles[j])) {
            land[j] = region;
            queue.push(j);
          }
    }
  for (const n of w.nations.filter((n) => n.alive)) {
    const e = eraOf(n),
      cities = w.life!.settlements.filter((c) => c.nation === n.id && c.urban);
    const c = cities.find((c) => c.urban!.port) || cities[0];
    if (!c) continue;
    if (
      s.projects.length < 250 &&
      e >= 3 &&
      n.wealth > 90 &&
      !s.projects!.some((p) => p.nation === n.id && p.status === "building")
    ) {
      const candidates = w.tiles
        .map((t, i) => ({ t, i }))
        .filter(
          ({ t, i }) =>
            !s.projects!.some((p) => p.tile === i && p.status === "building") &&
            ((t.owner === n.id &&
              t.biome === "arid" &&
              !t.irrigated &&
              (e >= 7 ||
                adjacent(w, i).some(
                  (j) => isWater(w.tiles[j]) || w.tiles[j].river,
                ))) ||
              (e >= 7 &&
                c.urban!.port &&
                t.t === 0 &&
                !t.owner &&
                i % w.width > 3 &&
                i % w.width < w.width - 4 &&
                Math.floor(i / w.width) > 3 &&
                Math.floor(i / w.width) < w.height - 4 &&
                adjacent(w, i).some(
                  (j) => w.tiles[j].owner === n.id && !isWater(w.tiles[j]),
                ))),
        );
      const target =
        candidates[(w.year / 48 + n.id) % Math.max(1, candidates.length)];
      if (target && c.urban!.stock.stone >= 12 && c.urban!.stock.timber >= 8) {
        c.urban!.stock.stone -= 12;
        c.urban!.stock.timber -= 8;
        n.wealth -= 60;
        const kind = target.t.t === 0 ? "reclamation" : "irrigation";
        s.projects.push({
          id: s.nextId++,
          nation: n.id,
          city: c.id,
          tile: target.i,
          kind,
          started: w.year,
          progress: 0,
          duration: kind === "reclamation" ? 24 : 12,
          status: "building",
        });
        record(
          w,
          `${n.name} ${kind === "reclamation" ? "해안 간척" : "사막 관개"} 착공 · 석재 12 / 목재 8 투입`,
          [n.id],
          target.i,
        );
      }
    }
    if (
      e < 5 ||
      !c.urban!.port ||
      c.population < 160 ||
      c.urban!.stock.food < 35 ||
      c.urban!.stock.timber < 12 ||
      n.wealth < 80 ||
      s.vehicles.length >= 180 ||
      s.vehicles.some((v) => v.nation === n.id && v.purpose === "colonize")
    )
      continue;
    const target = w.tiles.findIndex(
      (t, i) =>
        !t.owner &&
        !isWater(t) &&
        t.t !== 4 &&
        t.t !== 5 &&
        land[i] !== land[c.tile] &&
        adjacent(w, i).some((j) => w.tiles[j].t === 0),
    );
    if (target < 0) continue;
    const shore = adjacent(w, target).find((j) => w.tiles[j].t === 0)!;
    const path = transportPath(w, c.urban!.portTile, shore, true);
    if (path.length < 2) continue;
    const total = c.urban!.cohorts.reduce((a, b) => a + b, 0);
    if (total < 160) continue;
    const people = c.urban!.cohorts.map((x) => (x / total) * 24) as [
      number,
      number,
      number,
    ];
    c.urban!.cohorts = c.urban!.cohorts.map((x, k) => x - people[k]) as [
      number,
      number,
      number,
    ];
    consumeNation(w, n, "food", 25);
    c.urban!.stock.timber -= 12;
    n.wealth -= 60;
    s.vehicles.push({
      id: s.nextId++,
      route: 0,
      mode: "sea",
      nation: n.id,
      targetNation: n.id,
      from: c.id,
      to: c.id,
      path,
      progress: 0,
      previousProgress: 0,
      cargo: { food: 25, timber: 6 },
      people,
      purpose: "colonize",
      targetTile: target,
      strength: 0,
      returning: false,
    });
    record(w, `${n.name} 개척선 출항 · 주민 24명, 새 대륙으로`, [n.id], c.tile);
  }
}
