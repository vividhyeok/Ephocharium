import { record, type World } from "./engine";
import { eraOf } from "./eras";
import { adjacent, isWater, crossingCost, MinHeap } from "./geography";
import { consumeNation, stockNation } from "./resources";
import {
  MATERIALS,
  type Material,
  type TransportMode,
  type TransportRoute,
  type Vehicle,
  type Cohorts,
} from "./livingTypes";
import { sum } from "./demographics";
import { blendCulture } from "./culture";
import { advanceResearch } from "./progression";
import type { Settlement } from "./civilization";
const atWar = (w: World, a: number, b: number) =>
  w.relations.some(
    (r) => r.war && ((r.a === a && r.b === b) || (r.a === b && r.b === a)),
  );
const pathCaches = new WeakMap<World, Map<string, number[]>>();
export function transportPath(
  w: World,
  start: number,
  end: number,
  water = false,
  advanced = false,
) {
  let cache = pathCaches.get(w);
  if (!cache) {
    cache = new Map();
    pathCaches.set(w, cache);
  }
  const key = [
    w.year,
    w.living?.landRevision || 0,
    start,
    end,
    +water,
    +advanced,
  ].join(":");
  if (cache.has(key)) return [...cache.get(key)!];
  const heap = new MinHeap(),
    cost = new Map([[start, 0]]),
    parents = new Map<number, number>();
  heap.push(start, 0);
  let examined = 0;
  while (heap.length && examined++ < w.tiles.length) {
    const { i, v } = heap.pop();
    if (v !== cost.get(i)) continue;
    if (i === end) {
      const out: number[] = [];
      let k = end;
      while (k !== start) {
        out.push(k);
        k = parents.get(k)!;
      }
      out.push(start);
      out.reverse();
      if (cache.size > 192) cache.clear();
      cache.set(key, out);
      return out;
    }
    for (const j of adjacent(w, i)) {
      const t = w.tiles[j];
      if (
        water
          ? !isWater(t)
          : t.t === 0 || t.lake || t.t === 5 || (t.t === 4 && !advanced)
      )
        continue;
      const next =
        v +
        (water
          ? 1
          : crossingCost(t) / (1 + (t.road || 0) * 0.5 + (t.rail || 0)));
      if (next < (cost.get(j) ?? Infinity)) {
        cost.set(j, next);
        parents.set(j, i);
        heap.push(j, next);
      }
    }
  }
  cache.set(key, []);
  return [];
}
const distance = (w: World, a: number, b: number) =>
  Math.hypot(
    (a % w.width) - (b % w.width),
    Math.floor(a / w.width) - Math.floor(b / w.width),
  );
function endpoint(w: World, c: Settlement) {
  if (isWater(w.tiles[c.tile])) return c.tile;
  return adjacent(w, c.tile).find((i) => isWater(w.tiles[i])) ?? -1;
}
export function buildNetworks(w: World) {
  const s = w.living!,
    cities = w.life!.settlements.filter(
      (c) => w.nations[c.nation - 1]?.alive && c.urban,
    );
  for(const r of s.routes) {
    if(r.mode!=='road')continue;
    const a=cities.find(c=>c.id===r.from),b=cities.find(c=>c.id===r.to);
    if(!a||!b)continue;
    const n=w.nations[a.nation-1];
    if(Math.min(eraOf(n),eraOf(w.nations[b.nation-1]))<7 || (n.inventory?.metal||0)<1 || (n.inventory?.coal||0)<.2)continue;
    if(!consumeNation(w,n,'metal',1)||!consumeNation(w,n,'coal',.2))continue;
    r.mode='rail';r.capacity=18;a.urban!.station=b.urban!.station=1;
    for(const i of r.path)w.tiles[i].rail=1;
    record(w,a.name+'–'+b.name+' 철도 개량',[a.nation,b.nation],a.tile);
  }
  const existing = new Map(
    s.routes.map((r) => [
      [Math.min(r.from, r.to), Math.max(r.from, r.to), r.mode].join(":"),
      r,
    ]),
  );
  for (const c of cities) {
    const n = w.nations[c.nation - 1],
      u = c.urban!,
      e = eraOf(n),
      water = endpoint(w, c);
    if (
      e >= 2 &&
      water >= 0 &&
      c.population > 50 &&
      n.wealth > 60 &&
      !u.port &&
      consumeNation(w, n, "timber", 3) &&
      consumeNation(w, n, "stone", 1)
    ) {
      u.port = 1;
      u.portTile = water;
      n.wealth -= 25;
      record(w, c.name + " 선착장 개항", [n.id], c.tile);
    }
    if (
      u.port &&
      u.imported > 1 &&
      n.wealth > 300 &&
      u.port < Math.min(5, 1 + Math.floor(e / 3))
    ) {
      u.port += 0.05;
      n.wealth -= 0.2;
    }
    const candidates = cities
      .filter(
        (b) =>
          b.id !== c.id &&
          !atWar(w, c.nation, b.nation) &&
          (c.nation === b.nation || e >= 2),
      )
      .sort((a, b) => distance(w, c.tile, a.tile) - distance(w, c.tile, b.tile))
      .slice(0, 3);
    for (const b of candidates) {
      if (s.routes.filter(r=>r.mode==='road'||r.mode==='rail').length >= 150) break;
      const other = w.nations[b.nation - 1],
        both = Math.min(e, eraOf(other));
      let mode: TransportMode = "road",
        path: number[] = [];
      if (c.nation === b.nation || distance(w, c.tile, b.tile) < w.width * 0.35)
        path = transportPath(w, c.tile, b.tile, false, both >= 7);
      if (
        path.length &&
        both >= 7 &&
        c.urban!.roles.some(
          (r) => r === "mine" || r === "industry" || r === "capital",
        ) &&
        (n.inventory?.metal || 0) >= 0.5 &&
        (n.inventory?.coal || 0) >= 0.2
      )
        mode = "rail";
      if (!path.length && u.port && b.urban!.port) {
        path = transportPath(w, u.portTile, b.urban!.portTile, true);
        mode = path.some((i) => w.tiles[i].t === 0) ? "sea" : "river";
      }
      if (!path.length && both >= 9 && c.airport && b.airport) {
        path = [c.tile, b.tile];
        mode = "air";
      }
      if (!path.length) continue;
      if (
        (mode === "road" || mode === "rail") &&
        path.some((i) => (w.tiles[i].river || 0) > 1.5 && !w.tiles[i].bridge) &&
        (both < 3 || !consumeNation(w, n, "stone", 1))
      )
        continue;
      const key = [Math.min(c.id, b.id), Math.max(c.id, b.id), mode].join(":");
      if (existing.has(key)) continue;
      if(mode==='rail' && (!consumeNation(w,n,'metal',.5)||!consumeNation(w,n,'coal',.2)))continue;
      if (
        n.wealth < 20 ||
        (mode === "road" && !consumeNation(w, n, "timber", 0.5))
      )
        continue;
      const route: TransportRoute = {
        id: s.nextId++,
        from: c.id,
        to: b.id,
        mode,
        path,
        capacity:
          mode === "air"
            ? 2
            : mode === "rail"
              ? 18
              : mode === "sea"
                ? 14
                : mode === "river"
                  ? 8
                  : 4,
        delivered: 0,
        blocked: false,
        built: w.year,
      };
      s.routes.push(route);
      existing.set(key, route);
      n.wealth -= 10;
      if (mode === "rail") {
        u.station = 1;
        b.urban!.station = 1;
        record(
          w,
          c.name + "–" + b.name + " 철도 개통",
          [c.nation, b.nation],
          c.tile,
        );
      }
      for (const i of path)
        if (mode === "road" || mode === "rail") {
          const t = w.tiles[i];
          t.road = Math.min(1, (t.road || 0) + 0.2);
          if (mode === "rail") t.rail = 1;
          if (t.river) {
            t.bridge = true;
          }
          if (t.t === 4 && both >= 7) t.tunnel = true;
        }
    }
  }
  s.routes = s.routes.filter(
    (r) =>
      cities.some((c) => c.id === r.from) && cities.some((c) => c.id === r.to),
  );
  // Water and air services coexist with roads; a land connection must not suppress ships.
  for (const c of cities) {
    const n = w.nations[c.nation - 1];
    for (const mode of ["sea", "air"] as const) {
      if(s.routes.filter(r=>mode==='sea' ? r.mode==='sea'||r.mode==='river' : r.mode==='air').length >= (mode==='sea'?60:25))continue;
      if (mode === "sea" ? !c.urban!.port : !c.airport || eraOf(n) < 9)
        continue;
      const destinations = cities
        .filter(
          (b) =>
            b.id !== c.id &&
            !atWar(w, c.nation, b.nation) &&
            (mode === "sea"
              ? b.urban!.port
              : b.airport && eraOf(w.nations[b.nation - 1]) >= 9),
        )
        .sort(
          (a, b) =>
            (a.nation === c.nation ? 1 : 0) - (b.nation === c.nation ? 1 : 0) ||
            distance(w, c.tile, a.tile) - distance(w, c.tile, b.tile),
        )
        .slice(0, 2);
      for (const b of destinations) {
        const key = [Math.min(c.id, b.id), Math.max(c.id, b.id), mode].join(
          ":",
        );
        if (
          existing.has(key) ||
          s.routes.some(
            (r) =>
              mode === "sea" &&
              (r.mode === "sea" || r.mode === "river") &&
              ((r.from === c.id && r.to === b.id) ||
                (r.from === b.id && r.to === c.id)),
          ) ||
          s.routes.length >= 240 ||
          n.wealth < 20
        )
          continue;
        const path =
          mode === "air"
            ? [c.tile, b.tile]
            : transportPath(w, c.urban!.portTile, b.urban!.portTile, true);
        if (path.length < 2) continue;
        const r: TransportRoute = {
          id: s.nextId++,
          from: c.id,
          to: b.id,
          mode:
            mode === "sea" && !path.some((i) => w.tiles[i].t === 0)
              ? "river"
              : mode,
          path,
          capacity: mode === "air" ? 6 : 20,
          delivered: 0,
          blocked: false,
          built: w.year,
        };
        s.routes.push(r);
        existing.set(key, r);
        n.wealth -= 10;
        record(
          w,
          c.name +
            "–" +
            b.name +
            (mode === "air" ? " 국제 항공로" : " 수상 교역로") +
            " 개통",
          [c.nation, b.nation],
          c.tile,
        );
      }
    }
  }
  s.lastNetwork = w.year;
}
function vehicle(
  w: World,
  r: TransportRoute,
  from: Settlement,
  to: Settlement,
  purpose: Vehicle["purpose"] = "trade",
): Vehicle {
  const reversed = r.from !== from.id,
    path = reversed ? [...r.path].reverse() : [...r.path];
  return {
    id: w.living!.nextId++,
    route: r.id,
    mode: r.mode,
    nation: from.nation,
    targetNation: to.nation,
    from: from.id,
    to: to.id,
    path,
    progress: 0,
    previousProgress: 0,
    cargo: {},
    purpose,
    strength: 0,
    returning: false,
  };
}
export function transportYear(w: World) {
  const s = w.living!,
    cities = new Map(w.life!.settlements.filter(c=>c.urban).map((c) => [c.id, c]));
  s.trade = 0;
  s.migrants = 0;
  const signature = w.life!.settlements.length;
  if (w.year - s.lastNetwork >= 24 || (!s.routes.length && w.year % 8 === 0))
    buildNetworks(w);
  for (const c of cities.values()) {
    if (c.urban) {
      c.urban.logistics = 0.1;
      c.urban.imported = 0;
      c.urban.exported = 0;
    }
  }
  for (const r of s.routes) {
    const a = cities.get(r.from),
      b = cities.get(r.to);
    if (!a?.urban || !b?.urban) continue;
    r.blocked =
      atWar(w, a.nation, b.nation) ||
      r.path.some(
        (i) => w.tiles[i].owner && atWar(w, a.nation, w.tiles[i].owner),
      ) ||
      r.path.some((i) => (w.tiles[i].damage || 0) > 0.65) ||
      s.vehicles.some(
        (v) =>
          v.purpose === "escort" &&
          atWar(w, v.nation, a.nation) &&
          distance(
            w,
            v.path[Math.min(v.path.length - 1, Math.floor(v.progress))],
            r.path[Math.floor(r.path.length / 2)],
          ) < 4,
      );
    if (r.blocked) continue;
    a.urban.logistics = Math.min(1, a.urban.logistics + 0.22);
    b.urban.logistics = Math.min(1, b.urban.logistics + 0.22);
    if (
      s.vehicles.length >= 160 ||
      s.vehicles.some((v) => v.route === r.id && v.purpose === "trade")
    )
      continue;
    const source = MATERIALS.map((key) => {
      const excessA =
          a.urban!.stock[key] -
          (key === "food" ? a.population * 0.6 : key === "timber" ? 8 : 2),
        excessB =
          b.urban!.stock[key] -
          (key === "food" ? b.population * 0.6 : key === "timber" ? 8 : 2);
      return {
        key,
        gap: Math.abs(excessA - excessB) / (key === "food" ? 50 : 1),
        from: excessA > excessB ? a : b,
        to: excessA > excessB ? b : a,
        excess: Math.max(excessA, excessB),
      };
    }).sort((a, b) => b.gap - a.gap)[0];
    if (!source || source.excess < 1) continue;
    const n = w.nations[source.from.nation - 1];
    if (n.wealth < 1) continue;
    if (r.mode === "air" && !consumeNation(w, n, "oil", 0.1)) continue;
    const amount = Math.min(
      r.capacity,
      source.excess,
      source.gap * (source.key === "food" ? 50 : 1) * 0.25,
    );
    if (amount < 0.1) continue;
    source.from.urban!.stock[source.key] -= amount;
    const v = vehicle(w, r, source.from, source.to);
    v.cargo[source.key] = amount;
    s.vehicles.push(v);
    n.wealth -= r.mode === "air" ? 1 : 0.1;
  }
  if (w.year % 8 === 0)
    for (const from of cities.values()) {
      const u = from.urban!;
      if (!u || from.population < 80 || s.vehicles.length >= 180) continue;
      const options = s.routes
        .filter((r) => !r.blocked && (r.from === from.id || r.to === from.id))
        .map((r) => ({
          r,
          to: cities.get(r.from === from.id ? r.to : r.from)!,
        }))
        .filter((x) => x.to?.urban && !atWar(w, from.nation, x.to.nation));
      const target = options.sort(
        (a, b) =>
          b.to.urban!.capacity -
          b.to.population -
          (a.to.urban!.capacity - a.to.population),
      )[0];
      if (
        !target ||
        target.to.urban!.capacity < target.to.population * 1.05 ||
        (u.pressure < 0.05 &&
          target.to.population > 20 &&
          !w.relations.some(
            (r) => r.war && (r.a === from.nation || r.b === from.nation),
          ))
      )
        continue;
      const amount = Math.min(20, from.population * 0.015);
      const people = u.cohorts.map(
        (v) => (v / from.population) * amount,
      ) as Cohorts;
      u.cohorts = u.cohorts.map((v, k) =>
        Math.max(0, v - people[k]),
      ) as Cohorts;
      const v = vehicle(w, target.r, from, target.to, "migration");
      v.people = people;
      s.vehicles.push(v);
      s.migrants += amount;
    }
  for (const v of [...s.vehicles]) {
    const a = cities.get(v.from),
      b = cities.get(v.to);
    if (!a || !b || !b.urban) {
      s.vehicles = s.vehicles.filter((x) => x !== v);
      continue;
    }
    v.previousProgress = v.progress;
    const e = eraOf(w.nations[v.nation - 1]),
      speed =
        v.mode === "air"
          ? 10
          : v.mode === "rail"
            ? 3 + e * 0.15
            : v.mode === "sea" || v.mode === "river"
              ? 1.4 + e * 0.15
              : 1 + (e >= 7 ? 1 : 0);
    v.progress += speed;
    const span =
      v.mode === "air"
        ? Math.max(1, distance(w, v.path[0], v.path.at(-1)!))
        : v.path.length - 1;
    const blocked = s.routes.find((r) => r.id === v.route)?.blocked;
    if (blocked && v.purpose === "trade") {
      s.lostCargo += Object.values(v.cargo).reduce((n, x) => n + (x || 0), 0);
      s.vehicles = s.vehicles.filter((x) => x !== v);
      continue;
    }
    if (v.progress < span) continue;
    if (v.purpose === "trade") {
      for (const k of MATERIALS) {
        const amount = v.cargo[k] || 0;
        b.urban.stock[k] += amount;
        b.urban.imported += amount;
        a.urban!.exported += amount;
        s.trade += amount;
        const route = s.routes.find((r) => r.id === v.route);
        if (route) route.delivered += amount;
      }
      w.nations[v.nation - 1].wealth +=
        Object.values(v.cargo).reduce((x, y) => x + (y || 0), 0) * 0.2;
      if (v.nation !== v.targetNation) {
        const x = w.nations[v.nation - 1],
          y = w.nations[v.targetNation - 1];
        advanceResearch(w, y, Math.max(0, x.tech - y.tech) * 0.0005);
        blendCulture(w, v.nation, v.targetNation, 0.003);
      }
    }
    if (v.purpose === "migration" && v.people) {
      for (let k = 0; k < 3; k++) b.urban.cohorts[k] += v.people[k];
      s.migrants += sum(v.people);
      if (v.nation !== v.targetNation)
        blendCulture(w, v.nation, v.targetNation, 0.008);
    }
    if (v.purpose === "landing" && v.strength > 5) {
      const tile = adjacent(w, b.urban.portTile).find(
        (i) => w.tiles[i].owner === v.targetNation && w.tiles[i].t !== 0,
      );
      if (tile !== undefined)
        w.life!.armies.push({
          id: w.life!.nextId++,
          nation: v.nation,
          enemy: v.targetNation,
          x: (tile % w.width) + 0.5,
          y: Math.floor(tile / w.width) + 0.5,
          previousX: (tile % w.width) + 0.5,
          previousY: Math.floor(tile / w.width) + 0.5,
          route: [],
          target: tile,
          strength: v.strength,
          siege: 0,
          fighting: false,
        });
    }
    if (v.purpose === "support") {
      w.nations[v.nation - 1].airSupport = { tile: b.tile, until: w.year + 4 };
      b.urban.damage = Math.min(1, b.urban.damage + 0.03);
    }
    if (v.purpose === "airlift") {
      const army = w.life!.armies.find((x) => x.nation === v.nation);
      if (army) army.strength += v.strength;
    }
    if (v.purpose === "escort") {
      v.progress = 0;
      v.previousProgress = 0;
      v.path.reverse();
      continue;
    }
    s.vehicles = s.vehicles.filter((x) => x !== v);
  }
  if (w.year % 12 === 0) militaryTransport(w, [...cities.values()]);
  for (const n of w.nations.filter((n) => n.alive)) {
    stockNation(w, n);
    n.food = n.inventory!.food;
    const home = w.life!.settlements.filter(
      (c) => c.nation === n.id && c.urban,
    );
    n.population =
      home.reduce((s, c) => s + sum(c.urban!.cohorts), 0) +
      s.vehicles
        .filter((v) => v.nation === n.id && v.people)
        .reduce((s, v) => s + sum(v.people!), 0);
    if (n.demography) n.demography.migration = s.migrants;
  }
}
function militaryTransport(w: World, cities: Settlement[]) {
  const s = w.living!;
  for (const war of w.relations.filter((r) => r.war))
    for (const [id, enemy] of [
      [war.a, war.b],
      [war.b, war.a],
    ]) {
      if (s.vehicles.length >= 180) continue;
      const n = w.nations[id - 1],
        e = eraOf(n),
        from = cities.find((c) => c.nation === id && c.urban!.port),
        to = cities.find((c) => c.nation === enemy && c.urban!.port);
      if (
        e >= 3 &&
        from &&
        to &&
        !s.vehicles.some((v) => v.nation === id && v.purpose === "landing") &&
        consumeNation(w, n, "timber", 2) &&
        n.wealth > 20
      ) {
        const path = transportPath(
          w,
          from.urban!.portTile,
          to.urban!.portTile,
          true,
        );
        if (path.length) {
          s.vehicles.push({
            id: s.nextId++,
            route: 0,
            mode: "sea",
            nation: id,
            targetNation: enemy,
            from: from.id,
            to: to.id,
            path,
            progress: 0,
            previousProgress: 0,
            cargo: {},
            purpose: "landing",
            strength: Math.min(90, n.population * 0.02),
            returning: false,
          });
          if (
            !s.vehicles.some((v) => v.nation === id && v.purpose === "escort")
          )
            s.vehicles.push({
              id: s.nextId++,
              route: 0,
              mode: "sea",
              nation: id,
              targetNation: enemy,
              from: from.id,
              to: to.id,
              path: [...path],
              progress: 0,
              previousProgress: 0,
              cargo: {},
              purpose: "escort",
              strength: 30 + e * 5,
              returning: false,
            });
          n.wealth -= 15;
        }
      }
      const airFrom = cities.find((c) => c.nation === id && c.airport),
        airTo = cities.find((c) => c.nation === enemy);
      const supplyTo=cities.filter(c=>c.nation===id && c.id!==airFrom?.id).sort((a,b)=>b.urban!.damage-a.urban!.damage)[0];
      if(e>=9 && airFrom && supplyTo && w.life!.armies.some(a=>a.nation===id) && !s.vehicles.some(v=>v.nation===id&&v.purpose==='airlift') && airFrom.urban!.stock.food>=3 && consumeNation(w,n,'oil',.3)) {
        airFrom.urban!.stock.food-=3;
        s.vehicles.push({id:s.nextId++,route:0,mode:'air',nation:id,targetNation:id,from:airFrom.id,to:supplyTo.id,path:[airFrom.tile,supplyTo.tile],progress:0,previousProgress:0,cargo:{food:3},purpose:'airlift',strength:3,returning:false});
      }
      if (
        e >= 9 &&
        airFrom &&
        airTo &&
        !s.vehicles.some((v) => v.nation === id && v.purpose === "support") &&
        consumeNation(w, n, "oil", 0.5) &&
        n.wealth > 10
      ) {
        s.vehicles.push({
          id: s.nextId++,
          route: 0,
          mode: "air",
          nation: id,
          targetNation: enemy,
          from: airFrom.id,
          to: airTo.id,
          path: [airFrom.tile, airTo.tile],
          progress: 0,
          previousProgress: 0,
          cargo: {},
          purpose: "support",
          strength: 20,
          returning: false,
        });
        n.wealth -= 5;
      }
    }
}
