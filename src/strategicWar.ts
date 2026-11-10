import type { Settlement } from "./civilization";
import { getRelation } from "./diplomacy";
import { record, type Nation, type World } from "./engine";
import { eraOf } from "./eras";
import { consumeNation } from "./resources";

export interface Missile {
  attacker: number;
  defender: number;
  from: number;
  target: number;
  city: number;
  launched: number;
  arrives: number;
}

function resolveMissiles(w: World, cities: Map<number, Settlement>) {
  w.missiles = (w.missiles || []).filter((m) => {
    const attacker = w.nations[m.attacker - 1];
    const defender = w.nations[m.defender - 1];
    const city = cities.get(m.city);
    const tile = w.tiles[m.target];
    const pair = [m.attacker, m.defender];
    if (
      !attacker.alive ||
      !defender.alive ||
      defender.protected ||
      !getRelation(w, m.attacker, m.defender).war ||
      !city?.urban ||
      city.nation !== defender.id ||
      city.tile !== m.target ||
      tile.owner !== defender.id
    ) {
      record(
        w,
        "전선 변화로 비행 중인 미사일의 공격이 중단됐습니다",
        pair,
        m.target,
      );
      return false;
    }
    if (m.arrives > w.year) return true;
    const energy =
      w.life?.polities.find((p) => p.nation === defender.id)?.energy || 0;
    if (
      eraOf(defender) >= 10 &&
      energy >= 1 &&
      defender.tech >= attacker.tech * 0.85 &&
      consumeNation(w, defender, "metal", 1)
    ) {
      w.effects.push({ tile: m.target, kind: "intercept", life: 2 });
      record(
        w,
        defender.name + "이 " + city.name + " 상공에서 미사일을 요격했습니다",
        pair,
        m.target,
      );
      return false;
    }
    tile.damage = Math.min(0.9, tile.damage + 0.28);
    tile.road = Math.max(0, (tile.road || 0) - 0.3);
    tile.rail = Math.max(0, (tile.rail || 0) - 0.3);
    city.urban.damage = Math.min(0.95, city.urban.damage + 0.3);
    w.effects.push({ tile: m.target, kind: "missile", life: 3 });
    record(
      w,
      attacker.name +
        "의 미사일이 " +
        city.name +
        "을 타격해 도시 시설과 교통망을 파괴했습니다",
      pair,
      m.target,
    );
    return false;
  });
}

export function strategicWarYear(w: World) {
  if (!w.life || !w.living) return;
  const planning = w.year % 8 === 0 && w.relations.some((r) => r.war);
  if (!planning && !w.missiles?.length) return;
  const cities = new Map(w.life.settlements.map((city) => [city.id, city]));
  if (w.missiles?.length) resolveMissiles(w, cities);
  if (!planning) return;

  const byNation = new Map<number, Settlement[]>();
  for (const city of cities.values()) {
    if (
      !city.urban ||
      city.urban.lifecycle === "ruin" ||
      city.population < 10 ||
      w.tiles[city.tile].owner !== city.nation
    )
      continue;
    const list = byNation.get(city.nation);
    if (list) list.push(city);
    else byNation.set(city.nation, [city]);
  }
  const energy = new Map(w.life.polities.map((p) => [p.nation, p.energy || 0]));
  let attacks = 0;
  // Rotate priority so early nation IDs do not monopolize the global limit.
  const offset = Math.floor(w.year / 8) % w.relations.length;
  for (let i = 0; i < w.relations.length && attacks < 4; i++) {
    const r = w.relations[(i + offset) % w.relations.length];
    if (!r.war) continue;
    for (const id of [r.a, r.b]) {
      if (attacks >= 4) break;
      const a = w.nations[id - 1];
      const b = w.nations[(id === r.a ? r.b : r.a) - 1];
      if (
        !a.alive ||
        a.protected ||
        !b.alive ||
        b.protected ||
        (a.strategicReady ?? 0) > w.year ||
        (energy.get(id) || 0) < 0.4 ||
        a.wealth < 20 ||
        !byNation.has(id) ||
        !byNation.has(b.id)
      )
        continue;
      const era = eraOf(a);
      const targets = byNation.get(b.id)!;
      if (era < 9) continue;
      const preferCyber = (Math.floor(w.year / 16) + id) % 2 === 0;
      const cyber = () => cyberAttack(w, a, b, targets, era);
      const missile = () => launchMissile(w, a, b, targets, era);
      if (preferCyber ? cyber() || missile() : missile() || cyber()) {
        a.strategicReady = w.year + 16;
        attacks++;
      }
    }
  }
}

function cyberAttack(
  w: World,
  a: Nation,
  b: Nation,
  cities: Settlement[],
  era: number,
) {
  if (era < 10 || eraOf(b) < 10) return false;
  const target = cities
    .filter(
      (c) => (c.network || 0) >= 0.1 && (c.urban!.outageUntil ?? 0) <= w.year,
    )
    .sort(
      (x, y) =>
        (y.network || 0) +
        y.urban!.logistics -
        ((x.network || 0) + x.urban!.logistics),
    )[0];
  if (!target) return false;
  const years = b.tech > a.tech * 1.15 ? 2 : 5;
  a.wealth -= 20;
  target.urban!.outageUntil = w.year + years;
  w.effects.push({ tile: target.tile, kind: "cyber", life: years });
  record(
    w,
    a.name +
      "의 사이버 공격으로 " +
      target.name +
      "의 교역망이 " +
      years +
      "년간 마비됐습니다",
    [a.id, b.id],
    target.tile,
  );
  return true;
}

function launchMissile(
  w: World,
  a: Nation,
  b: Nation,
  cities: Settlement[],
  era: number,
) {
  const source = w.tiles[a.capital];
  if (a.wealth < 45 || source.owner !== a.id || (w.missiles?.length ?? 0) >= 32)
    return false;
  const range = 38 + (era - 9) * 19;
  const target = cities
    .map((city) => ({
      city,
      distance: Math.hypot(
        (city.tile % w.width) - (a.capital % w.width),
        Math.floor(city.tile / w.width) - Math.floor(a.capital / w.width),
      ),
      value:
        (city.industry || 0) +
        city.urban!.port +
        city.urban!.station +
        Number(city.airport) -
        city.urban!.damage,
    }))
    .filter((x) => x.distance <= range)
    .sort((x, y) => y.value - x.value || x.distance - y.distance)[0];
  if (!target) return false;
  let metal = 0;
  let oil = 0;
  for (const city of w.life!.settlements) {
    if (city.nation !== a.id || !city.urban) continue;
    metal += city.urban.stock.metal;
    oil += city.urban.stock.oil;
  }
  if (metal < 6 || oil < 1) return false;
  consumeNation(w, a, "metal", 6);
  consumeNation(w, a, "oil", 1);
  a.wealth -= 45;
  (w.missiles ??= []).push({
    attacker: a.id,
    defender: b.id,
    from: a.capital,
    target: target.city.tile,
    city: target.city.id,
    launched: w.year,
    arrives: w.year + Math.max(1, Math.ceil(target.distance / 24)),
  });
  record(
    w,
    a.name +
      "이 " +
      target.city.name +
      "의 기반시설을 향해 미사일을 발사했습니다",
    [a.id, b.id],
    a.capital,
  );
  return true;
}
