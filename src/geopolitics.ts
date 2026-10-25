import { record, type World, type Nation, type Relation } from "./engine";
import { eraOf } from "./eras";
import { adjacent, isWater } from "./geography";
import { transportPath } from "./transport";
import { getRelation, treaty } from "./diplomacy";
import { consumeNation, creditNation, stockNation } from "./resources";
import { populationLoss } from "./militaryLogistics";

const key = (a: number, b: number) => Math.min(a, b) + ":" + Math.max(a, b);
const strength = (n: Nation) =>
  Math.sqrt(Math.max(1, n.population)) * (1 + Math.sqrt(n.tech)) *
  (0.4 + n.stability * 0.6);
const hunger = (n: Nation) =>
  Math.max(0, Math.min(1, (0.9 - n.food / Math.max(1, n.population)) / 0.9));

/** Transfer real stored supplies; raid damages the relationship and both populations. */
export function raidForResources(
  w: World, r: Relation, attacker: Nation, victim: Nation, overseas = false,
) {
  if (r.war || r.allied || r.subject || attacker.population < 45 ||
      attacker.wealth < 8 || victim.protected || victim.population < 30 ||
      w.year - (r.lastRaidYear ?? -10000) < 40) return false;
  const grain = Math.min(victim.food * 0.12, attacker.population * 0.15);
  const taken = grain >= 1 && consumeNation(w, victim, "food", grain) ? grain : 0;
  const silver = Math.min(victim.wealth * 0.09, 30);
  if (!taken && silver < 1) return false;
  if (taken) {
    creditNation(w, attacker, "food", taken * (overseas ? 0.65 : 0.82));
    victim.food = stockNation(w, victim).food;
    attacker.food = stockNation(w, attacker).food;
  }
  victim.wealth = Math.max(0, victim.wealth - silver);
  attacker.wealth += silver * (overseas ? 0.6 : 0.78);
  populationLoss(w, attacker, Math.min(4, Math.max(0.25, victim.population * 0.001)));
  populationLoss(w, victim, Math.min(3, victim.population * 0.001));
  r.lastRaidYear = w.year;
  r.score = Math.max(-1, r.score - 0.24);
  r.grievance = Math.min(1, (r.grievance || 0) + 0.32);
  treaty(w, r, "raid",
    (overseas ? "항구와 보급로를 통한 해상 약탈" : "접경 지역 식량·재산 약탈") +
    " · 식량 " + Math.round(taken) + ", 재산 " + Math.round(silver) + " 탈취",
    attacker.id);
  return true;
}

/** Resolve years-long fleets and subject taxation; returns true while subordinated. */
export function progressImperialRelations(w: World, r: Relation, a: Nation, b: Nation) {
  if (r.expedition && w.year >= r.expedition.arrives) {
    const invader = w.nations[r.expedition.invader - 1];
    const defender = invader.id === a.id ? b : a;
    const succeeds = invader.alive && defender.alive && !r.war && !r.allied &&
      !r.subject && !defender.protected &&
      strength(invader) > strength(defender) * 1.6 &&
      r.expedition.strength > strength(defender) * 1.35;
    populationLoss(w, invader, Math.min(6, invader.population * (succeeds ? 0.002 : 0.006)));
    if (succeeds) {
      treaty(w, r, "subjugation",
        "해상 원정대가 보급로를 따라 상륙했고 현지 정부가 조공과 외교 종속을 받아들였습니다.",
        invader.id);
    } else {
      record(w, invader.name + "의 해외 원정 실패 · 보급 차질과 현지 저항",
        [invader.id, defender.id], defender.capital);
      r.score = Math.max(-1, r.score - 0.16);
      r.grievance = Math.min(1, (r.grievance || 0) + 0.2);
    }
    r.expedition = undefined;
  }
  if (!r.subject) return false;
  const subject = w.nations[r.subject - 1];
  const overlord = r.subject === a.id ? b : a;
  const years = w.year - (r.subjectSince ?? w.year);
  const recovered = strength(subject) > strength(overlord) * 0.78 &&
    subject.stability > 0.52 && years >= 64;
  const uprising = years >= 112 && subject.aggression > 0.58 &&
    subject.stability < 0.5 && (w.year + subject.id) % 24 === 0;
  if (!overlord.alive || subject.protected || recovered || uprising) {
    treaty(w, r, "independence",
      recovered ? "현지 국력과 자치 역량이 성장해 조공 관계에서 벗어났습니다." :
      "식민 종속에 대한 저항과 통치력 약화로 독립을 선언했습니다.", subject.id);
    return false;
  }
  if (w.year % 8 === 0) {
    const levy = Math.min(8, subject.wealth * 0.035);
    subject.wealth = Math.max(0, subject.wealth - levy);
    overlord.wealth += levy * 0.8;
    const grain = Math.min(subject.food * 0.025, subject.population * 0.06);
    if (grain > 0.2 && consumeNation(w, subject, "food", grain)) {
      creditNation(w, overlord, "food", grain * 0.8);
      subject.food = stockNation(w, subject).food;
      overlord.food = stockNation(w, overlord).food;
    }
    subject.stability = Math.max(0.02, subject.stability - 0.002);
  }
  return true;
}

/** Requires a real navigable sea passage from a functioning port to a foreign coast. */
function navalPassage(w: World, attacker: number, defender: number, coast: Map<number, number[]>) {
  const port = w.life?.settlements.find((c) =>
    c.nation === attacker && c.urban?.port && c.urban.portTile !== undefined);
  if (!port || port.urban?.portTile === undefined) return 0;
  const from = port.urban.portTile;
  const distance = (i: number) => Math.hypot(
    (i % w.width) - (from % w.width),
    Math.floor(i / w.width) - Math.floor(from / w.width));
  const shores = (coast.get(defender) || []).slice().sort((a, b) => distance(a) - distance(b));
  for (const shore of shores.slice(0, 4)) {
    const route = transportPath(w, from, shore, true);
    if (route.length >= 2 && route.length <= w.width * 1.2) return route.length;
  }
  return 0;
}

export function regionalPolitics(w: World) {
  const borders = new Set<string>();
  const adj = new Map<number, Set<number>>();
  const coasts = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (let i = 0; i < w.tiles.length; i++) {
    const owner = w.tiles[i].owner;
    if (!owner) continue;
    const shores = coasts.get(owner) || [];
    if (shores.length < 32) {
      const shore = adjacent(w, i).find((j) => isWater(w.tiles[j]));
      if (shore !== undefined && !shores.includes(shore)) {
        shores.push(shore);
        coasts.set(owner, shores);
      }
    }
    for (const j of [i + 1, i + w.width]) {
      if (j >= w.tiles.length || (j === i + 1 && j % w.width === 0)) continue;
      const other = w.tiles[j].owner;
      if (other && other !== owner) {
        borders.add(key(owner, other));
        link(owner, other);
        link(other, owner);
      }
    }
  }
  const alive = w.nations.filter((n) => n.alive);
  const allies = new Map(alive.map((n) => [n.id, 0]));
  const wars = new Map(alive.map((n) => [n.id, 0]));
  const subjects = new Set(w.relations.filter((r) => r.subject).map((r) => r.subject!));
  for (const r of w.relations) {
    if (r.allied) {
      allies.set(r.a, (allies.get(r.a) || 0) + 1);
      allies.set(r.b, (allies.get(r.b) || 0) + 1);
    }
    if (r.war) {
      wars.set(r.a, (wars.get(r.a) || 0) + 1);
      wars.set(r.b, (wars.get(r.b) || 0) + 1);
    }
  }
  const cap = (id: number) => Math.min(4, 2 + Math.floor(eraOf(w.nations[id - 1]) / 5));
  // Old saves with hundreds of treaty edges gradually unwind without a single huge event spike.
  let dissolved = 0;
  for (const r of w.relations.filter((r) => r.allied).sort((x, y) => x.score - y.score)) {
    if (dissolved >= 80) break;
    if ((allies.get(r.a) || 0) > cap(r.a) || (allies.get(r.b) || 0) > cap(r.b)) {
      treaty(w, r, "break", "과도한 방위 의무와 국익 충돌로 동맹이 종료되었습니다.");
      allies.set(r.a, Math.max(0, (allies.get(r.a) || 1) - 1));
      allies.set(r.b, Math.max(0, (allies.get(r.b) || 1) - 1));
      dissolved++;
    }
  }
  const threats = new Map(alive.map((n) => [n.id, new Set(
    [...(adj.get(n.id) || [])].filter((id) => {
      const other = w.nations[id - 1], r = getRelation(w, n.id, id);
      const old = other.samples.at(-4);
      return r.war || (other.aggression > 0.58 && strength(other) > strength(n) * 1.25) ||
        !!(old && other.territory > old.territory * 1.15 && other.territory > 20);
    })
  )]));
  let declared = 0, launched = 0, raided = 0;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const touch = borders.has(key(a.id, b.id));
      const common = [...threats.get(a.id)!].filter((id) => threats.get(b.id)!.has(id));
      const distance = Math.hypot(
        (a.capital % w.width) - (b.capital % w.width),
        Math.floor(a.capital / w.width) - Math.floor(b.capital / w.width));
      if (!touch && !(common.length && distance < w.width * 0.55) &&
          !(Math.max(eraOf(a), eraOf(b)) >= 5 && distance < w.width * 0.7))
        continue;
      const r = getRelation(w, a.id, b.id);
      if (r.war || r.subject) continue;
      const shortage = Math.max(hunger(a), hunger(b));
      const expansion = (a.aggression + b.aggression) / 2;
      const dominant = strength(a) >= strength(b) ? a : b;
      const weaker = dominant === a ? b : a;
      const techGap = Math.abs(eraOf(a) - eraOf(b));
      const imbalance = strength(dominant) / Math.max(1, strength(weaker));
      const imperial = eraOf(dominant) >= eraOf(weaker) + 2 &&
        imbalance > 1.8 && dominant.aggression > 0.43;
      const rivalry = touch ? Math.min(0.35, (imbalance - 1) * 0.13) + shortage * 0.26 : 0;
      const target = 0.17 + common.length * 0.27 - expansion * 0.43 -
        rivalry - (r.grievance || 0) * 0.5 - (touch ? techGap * 0.025 : 0) +
        (r.allied ? 0.09 : 0);
      r.score = Math.max(-1, Math.min(1, r.score + (target - r.score) * 0.13));
      const desperate = hunger(a) > hunger(b) + 0.18 ? a :
        hunger(b) > hunger(a) + 0.18 ? b : dominant;
      const victim = desperate === a ? b : a;
      const contested = (shortage > 0.34 && victim.food > victim.population * 0.5) ||
        (imperial && dominant.aggression > 0.56) ||
        (touch && a.aggression > 0.62 && b.aggression > 0.62);
      const strained = contested || r.score < -0.1 || (r.grievance || 0) > 0.28;
      if (r.allied) {
        if (strained && (r.score < 0.1 || (shortage > 0.5 && techGap >= 2))) {
          treaty(w, r, "break", "식량·교역로와 패권을 둘러싼 갈등으로 동맹을 파기했습니다.");
          allies.set(a.id, Math.max(0, (allies.get(a.id) || 1) - 1));
          allies.set(b.id, Math.max(0, (allies.get(b.id) || 1) - 1));
        } else continue;
      }
      if (subjects.has(a.id) || subjects.has(b.id) || r.expedition ||
          (r.truceUntil || 0) > w.year || w.year - r.since < 24) continue;
      const timing = (Math.floor(w.year / 8) + a.id * 17 + b.id * 23 + w.seed) % 4;
      if (touch && declared < 4 && timing === 0 && strained &&
          (wars.get(a.id) || 0) < 2 && (wars.get(b.id) || 0) < 2 &&
          Math.min(a.stability, b.stability) > 0.34 &&
          (desperate.aggression > 0.44 || dominant.aggression > 0.54)) {
        const actor = hunger(desperate) > 0.28 ? desperate : dominant;
        treaty(w, r, "war",
          hunger(actor) > 0.28 ? "식량 부족과 농경지·보급지 확보를 위한 국경 침공입니다." :
          imperial ? "강국이 자원과 전략적 영향권을 확보하기 위해 약소국을 침공했습니다." :
          "접경 교역로와 세력 균형을 둘러싼 경쟁이 무력 충돌로 이어졌습니다.", actor.id);
        wars.set(a.id, (wars.get(a.id) || 0) + 1);
        wars.set(b.id, (wars.get(b.id) || 0) + 1);
        declared++;
        continue;
      }
      if (touch && raided < 3 && timing === 1 && hunger(desperate) > 0.35 &&
          desperate.stability > 0.22 &&
          raidForResources(w, r, desperate, victim)) {
        raided++;
        continue;
      }
      if (!touch && launched < 2 && timing === 2 && imperial &&
          eraOf(dominant) >= 7 && dominant.population > 160 && dominant.wealth > 80 &&
          weaker.population > 30 && !weaker.protected && !subjects.has(weaker.id) &&
          (wars.get(dominant.id) || 0) < 2) {
        const voyage = navalPassage(w, dominant.id, weaker.id, coasts);
        if (voyage && consumeNation(w, dominant, "food", 20)) {
          dominant.food = stockNation(w, dominant).food;
          dominant.wealth -= 60;
          r.expedition = {
            invader: dominant.id,
            arrives: w.year + Math.max(3, Math.ceil(voyage / 5)),
            strength: strength(dominant) * 0.8,
          };
          record(w, dominant.name + "이 " + weaker.name +
            "에 대한 해상 종속 원정을 시작했습니다", [dominant.id, weaker.id], dominant.capital);
          launched++;
          continue;
        }
      }
      if (!touch && timing === 1 && raided < 3 &&
          (hunger(desperate) > 0.42 || (imperial && dominant.aggression > 0.6))) {
        const raider = imperial ? dominant : desperate;
        const targetNation = raider.id === a.id ? b : a;
        if (navalPassage(w, raider.id, targetNation.id, coasts) &&
            raidForResources(w, r, raider, targetNation, true))
          raided++;
      }
      if (common.length && r.score > 0.16 && w.year - r.since >= 48 &&
          (allies.get(a.id) || 0) < cap(a.id) && (allies.get(b.id) || 0) < cap(b.id) &&
          shortage < 0.5 && !contested && (r.grievance || 0) < 0.12 &&
          timing === 3) {
        treaty(w, r, "alliance", "공동의 팽창 위협에 대응하기 위한 제한적 방위 동맹을 맺었습니다.");
        allies.set(a.id, (allies.get(a.id) || 0) + 1);
        allies.set(b.id, (allies.get(b.id) || 0) + 1);
      }
      if (r.score > 0.1) {
        // Peaceful trade is independent from binding military alliances.
        a.wealth += 0.08;
        b.wealth += 0.08;
      }
    }
  }
}
