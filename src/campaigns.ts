import type { World, Nation } from "./engine";
import { adjacent, isWater } from "./geography";
import { transportPath } from "./transport";
import { getRelation, treaty } from "./diplomacy";
import { record } from "./engine";
export interface CampaignPlan {
  path: number[];
  naval: boolean;
  origin?: number;
  passage: number[];
  forced: number[];
}
export function passageAllowed(w: World, a: number, b: number) {
  if (!b || a === b) return true;
  const r = w.relations.find(
    (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a),
  );
  return (
    !!r &&
    !r.war &&
    (!!r.allied ||
      !!r.subject ||
      (r.accessUntil !== undefined && r.accessUntil >= w.year))
  );
}
const power = (n: Nation) =>
  Math.sqrt(Math.max(1, n.population)) *
  (1 + Math.sqrt(n.tech)) *
  (0.4 + n.stability * 0.6);
/** Bounded physical routing; no diplomatic change until an army is actually funded. */
export function planCampaign(
  w: World,
  nation: number,
  enemy: number,
  start: number,
  target: number,
): CampaignPlan | undefined {
  const n = w.nations[nation - 1];
  if (!n?.alive || !w.nations[enemy - 1]?.alive) return;
  const border = new Map<number, boolean>();
  const crossing = (owner: number) => {
    if (!owner || owner === nation || owner === enemy) return true;
    if (border.has(owner)) return border.get(owner)!;
    const host = w.nations[owner - 1];
    const r = w.relations.find(
      (r) =>
        (r.a === nation && r.b === owner) || (r.b === nation && r.a === owner),
    );
    const allowed =
      passageAllowed(w, nation, owner) ||
      (!host.protected &&
        (r?.war ||
          (r?.score || 0) > 0.15 ||
          (n.aggression >= 0.65 && power(n) >= power(host) * 1.6)));
    border.set(owner, !!allowed);
    return !!allowed;
  };
  const queue = [start],
    parents = new Map([[start, -1]]),
    passage = new Set<number>(),
    forced = new Set<number>();
  for (
    let c = 0;
    c < queue.length && c < Math.min(w.tiles.length, 12000);
    c++
  ) {
    const i = queue[c];
    if (i === target) {
      const path: number[] = [];
      let k = i;
      while (k !== start) {
        path.push(k);
        k = parents.get(k)!;
      }
      path.reverse();
      for (const t of path) {
        const owner = w.tiles[t].owner;
        if (
          owner &&
          owner !== nation &&
          owner !== enemy &&
          !passageAllowed(w, nation, owner)
        ) {
          const r = w.relations.find(
            (r) =>
              (r.a === nation && r.b === owner) ||
              (r.b === nation && r.a === owner),
          );
          if ((r?.score || 0) > 0.15) passage.add(owner);
          else forced.add(owner);
        }
      }
      return { path, naval: false, passage: [...passage], forced: [...forced] };
    }
    for (const j of adjacent(w, i)) {
      const t = w.tiles[j];
      if (
        parents.has(j) ||
        isWater(t) ||
        t.t === 4 ||
        t.t === 5 ||
        ((t.river || 0) > 1.5 && !t.bridge)
      )
        continue;
      if (!crossing(t.owner)) continue;
      parents.set(j, i);
      queue.push(j);
    }
  }
  // Embark only from an actual functioning port and sail a connected sea route.
  if (n.tech < 2) return;
  const ports =
    w.life?.settlements.filter(
      (c) =>
        c.nation === nation &&
        c.urban?.port &&
        c.urban.portTile !== undefined &&
        (c.urban.operation ?? 1) > 0.2,
    ) || [];
  if (!ports.length) return;
  const coasts = w.tiles
    .map((t, i) =>
      t.owner === enemy &&
      !isWater(t) &&
      adjacent(w, i).some((j) => isWater(w.tiles[j]))
        ? i
        : -1,
    )
    .filter((i) => i >= 0)
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
    .slice(0, 16);
  for (const p of ports.slice(0, 4)) {
    const approach =
      start === p.tile ? [] : transportPath(w, start, p.tile, false).slice(1);
    if (
      start !== p.tile &&
      (!approach.length ||
        approach.some((i) => !passageAllowed(w, nation, w.tiles[i].owner)))
    )
      continue;
    for (const coast of coasts)
      for (const sea of adjacent(w, coast).filter((i) => isWater(w.tiles[i]))) {
        const route = transportPath(w, p.urban!.portTile!, sea, true);
        if (route.length && route.length < w.width * 2)
          return {
            path: [...approach, ...route, coast],
            naval: true,
            origin: p.tile,
            passage: [],
            forced: [],
          };
      }
  }
}
export function negotiatePassage(w: World, nation: number, hosts: number[]) {
  for (const host of hosts) {
    const r = getRelation(w, nation, host);
    if (r.war) continue;
    r.accessUntil = w.year + 40;
    record(
      w,
      `${w.nations[host - 1].name}이 ${w.nations[nation - 1].name}에 40년간 군사 통행·보급권을 허용했습니다`,
      [nation, host],
      w.nations[host - 1].capital,
    );
  }
}
export function enterNeutral(
  w: World,
  nation: number,
  enemy: number,
  tile: number,
) {
  const host = w.tiles[tile].owner;
  if (
    !host ||
    host === nation ||
    host === enemy ||
    passageAllowed(w, nation, host)
  )
    return 0;
  const r = getRelation(w, nation, host);
  if (w.nations[host - 1].protected) return -1;
  if (!r.war)
    treaty(
      w,
      r,
      "war",
      "군사 통행 거부 뒤 강제 진입으로 중립국의 영토와 주권을 침해했습니다.",
      nation,
    );
  return host;
}
const waterCache = new WeakMap<
  World,
  { revision: number; regions: Int32Array }
>();
function seaRegions(w: World) {
  const revision = w.living?.geographyRevision || 0,
    cached = waterCache.get(w);
  if (cached?.revision === revision) return cached.regions;
  const regions = new Int32Array(w.tiles.length);
  let id = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    if (regions[i] || !isWater(w.tiles[i])) continue;
    const q = [i];
    regions[i] = ++id;
    for (let p = 0; p < q.length; p++)
      for (const j of adjacent(w, q[p]))
        if (!regions[j] && isWater(w.tiles[j])) {
          regions[j] = id;
          q.push(j);
        }
  }
  waterCache.set(w, { revision, regions });
  return regions;
}
export function navalSupplyOpen(
  w: World,
  nation: number,
  origin: number,
  tile: number,
) {
  const port = w.life?.settlements.find(
    (c) =>
      c.nation === nation &&
      c.tile === origin &&
      c.urban?.port &&
      (c.urban.operation ?? 1) > 0.2,
  );
  if (
    port?.urban?.portTile === undefined ||
    !isWater(w.tiles[port.urban.portTile])
  )
    return false;
  const queue = [tile],
    seen = new Set(queue),
    shores: number[] = [];
  for (let k = 0; k < queue.length && k < 1000 && shores.length < 12; k++) {
    const i = queue[k];
    if (isWater(w.tiles[i])) {
      shores.push(i);
      continue;
    }
    for (const j of adjacent(w, i)) {
      if (seen.has(j)) continue;
      seen.add(j);
      if (isWater(w.tiles[j])) shores.push(j);
      else if (w.tiles[j].owner === nation) queue.push(j);
    }
  }
  const blockers =
    w.life?.armies.filter(
      (a) =>
        a.nation !== nation &&
        w.relations.some(
          (r) =>
            r.war &&
            ((r.a === nation && r.b === a.nation) ||
              (r.b === nation && r.a === a.nation)),
        ) &&
        isWater(w.tiles[Math.floor(a.y) * w.width + Math.floor(a.x)]),
    ) || [];
  const sea = seaRegions(w),
    originSea = sea[port.urban.portTile];
  for (const shore of shores) {
    if (!originSea || sea[shore] !== originSea) continue;
    if (!blockers.length) return true;
    const path = transportPath(w, port.urban.portTile, shore, true);
    if (!path.length) continue;
    if (
      !blockers.some((a) =>
        path.some(
          (i) =>
            Math.hypot(
              (i % w.width) + 0.5 - a.x,
              Math.floor(i / w.width) + 0.5 - a.y,
            ) < 2,
        ),
      )
    )
      return true;
  }
  return false;
}
