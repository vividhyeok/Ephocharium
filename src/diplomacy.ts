import { advanceResearch } from "./progression";
import { eraOf } from "./eras";
import { record, neighbors, type World, type Relation } from "./engine";
export type TreatyKind = "war" | "peace" | "alliance" | "break" | "support";
export interface DiplomaticEvent {
  id: number;
  year: number;
  a: number;
  b: number;
  kind: TreatyKind;
  reason: string;
  actor?: number;
}
export const TREATY_LABELS: Record<TreatyKind, string> = {
  war: "전쟁 발발",
  peace: "평화 협정",
  alliance: "동맹 체결",
  break: "동맹 해체",
  support: "공동 방위",
};
export function initializeDiplomacy(w: World) {
  if (w.diplomacyLog) return;
  w.diplomacyLog = [];
  w.diplomacySequence = 0;
  for (const r of w.relations) {
    if (r.war) {
      w.diplomacyLog.push({
        id: ++w.diplomacySequence,
        year: r.since,
        a: r.a,
        b: r.b,
        kind: "war",
        reason:
          "이전 저장에서 진행 중인 전쟁입니다. 당시의 상세한 개전 원인은 기록되어 있지 않습니다.",
      });
    }
  }
}
const relationCaches = new WeakMap<
  World,
  { list: Relation[]; size: number; map: Map<string, Relation> }
>();
const pairKey = (a: number, b: number) => Math.min(a, b) + ":" + Math.max(a, b);
export function getRelation(w: World, a: number, b: number) {
  let cache = relationCaches.get(w);
  if (
    !cache ||
    cache.list !== w.relations ||
    cache.size !== w.relations.length
  ) {
    cache = {
      list: w.relations,
      size: w.relations.length,
      map: new Map(w.relations.map((r) => [pairKey(r.a, r.b), r])),
    };
    relationCaches.set(w, cache);
  }
  const key = pairKey(a, b);
  let r = cache.map.get(key);
  if (!r) {
    r = {
      a: Math.min(a, b),
      b: Math.max(a, b),
      score: 0,
      war: false,
      since: w.year,
      allied: false,
    };
    w.relations.push(r);
    cache.size++;
    cache.map.set(key, r);
  }
  return r;
}
export function treaty(
  w: World,
  r: Relation,
  kind: TreatyKind,
  reason: string,
  actor?: number,
) {
  initializeDiplomacy(w);
  if (kind === "war") {
    if (r.war) return;
    if (r.allied)
      treaty(
        w,
        r,
        "break",
        "무력 충돌로 상호 방위 조약이 파기되었습니다.",
        actor,
      );
    r.pastWars = (r.pastWars || 0) + 1;
    r.grievance = Math.min(1, (r.grievance || 0) + 0.35);
    r.war = true;
    r.allied = false;
    r.since = w.year;
    r.aggressor = actor;
    r.reason = reason;
  }
  if (kind === "peace") {
    if (!r.war) return;
    r.war = false;
    r.score = Math.max(0.2, r.score);
    r.since = w.year;
    r.reason = reason;
  }
  if (kind === "alliance") {
    if (r.allied) return;
    if (r.war)
      treaty(
        w,
        r,
        "peace",
        "플레이어의 중재로 교전을 멈추고 동맹 협상을 시작했습니다.",
        actor,
      );
    r.allied = true;
    r.allianceSince = w.year;
    r.score = Math.max(0.65, r.score);
    r.reason = reason;
  }
  if (kind === "break") {
    if (!r.allied) return;
    r.allied = false;
    r.reason = reason;
  }
  const event: DiplomaticEvent = {
    id: (w.diplomacySequence = (w.diplomacySequence || 0) + 1),
    year: w.year,
    a: r.a,
    b: r.b,
    kind,
    reason,
    actor,
  };
  w.diplomacyLog!.push(event);
  if (w.diplomacyLog!.length > 800) w.diplomacyLog!.shift();
  const a = w.nations[r.a - 1],
    b = w.nations[r.b - 1];
  record(
    w,
    `${a.name} · ${b.name} — ${TREATY_LABELS[kind]}`,
    [r.a, r.b],
    a.capital,
  );
}
export function updateDiplomacy(w: World) {
  initializeDiplomacy(w);
  if (w.year % 8 === 0) regionalPolitics(w);
  for (const r of [...w.relations]) {
    const a = w.nations[r.a - 1],
      b = w.nations[r.b - 1];
    if (!a?.alive || !b?.alive) {
      if (r.war) treaty(w, r, "peace", "교전국의 멸망으로 전쟁이 끝났습니다.");
      if (r.allied)
        treaty(w, r, "break", "동맹국의 멸망으로 조약이 종료되었습니다.");
      continue;
    }
    if (
      !r.war &&
      !r.allied &&
      r.score >= 0.22 &&
      w.year - r.since >= 40 &&
      (r.grievance || 0) < 0.2
    )
      treaty(
        w,
        r,
        "alliance",
        "접경 교역과 우호 관계가 쌓여 상호 방위·기술 교류 조약을 체결했습니다.",
      );
    if (r.allied && r.score < -0.4)
      treaty(
        w,
        r,
        "break",
        "국경 갈등과 악화된 신뢰 때문에 동맹을 유지하지 못했습니다.",
      );
    r.grievance = Math.max(0, (r.grievance || 0) - 0.0006);
    if (r.war) {
      a.wealth = Math.max(0, a.wealth - 2);
      b.wealth = Math.max(0, b.wealth - 2);
      a.stability = Math.max(0.02, a.stability - 0.011);
      b.stability = Math.max(0.02, b.stability - 0.011);
      if (
        w.year - r.since > 25 &&
        (a.stability < 0.4 || b.stability < 0.4 || w.year - r.since > 45)
      )
        treaty(
          w,
          r,
          "peace",
          "장기전의 보급 부담과 국내 피로로 휴전에 합의했습니다.",
        );
    }
    if (r.allied) {
      r.pactYears = (r.pactYears || 0) + 1;
      a.food += 0.8;
      b.food += 0.8;
      a.wealth += 0.35;
      b.wealth += 0.35;
      const gap = (a.tech - b.tech) * 0.000008;
      if (gap > 0) advanceResearch(w, b, gap);
      else advanceResearch(w, a, -gap);
    }
  }
  // Allies with a real shared front can join a defensive war; no armies teleport.
  const fronts = new Set<string>();
  if (w.relations.some((r) => r.war))
    for (let i = 0; i < w.tiles.length; i++) {
      const a = w.tiles[i].owner;
      if (!a) continue;
      for (const j of [i + 1, i + w.width]) {
        if (j >= w.tiles.length || (j === i + 1 && j % w.width === 0)) continue;
        const b = w.tiles[j].owner;
        if (b && a !== b) fronts.add(pairKey(a, b));
      }
    }
  const pacts = new Map<number, Relation[]>();
  for (const r of w.relations)
    if (r.allied) {
      for (const id of [r.a, r.b]) {
        if (!pacts.has(id)) pacts.set(id, []);
        pacts.get(id)!.push(r);
      }
    }
  const active = w.relations.filter((r) => r.war && r.aggressor !== undefined);
  for (const war of active) {
    const defender = war.aggressor === war.a ? war.b : war.a;
    for (const pact of pacts.get(defender) || []) {
      const ally = pact.a === defender ? pact.b : pact.a,
        enemy = war.aggressor!;
      if (
        ally === enemy ||
        !w.nations[ally - 1]?.alive ||
        w.nations[ally - 1].stability < 0.5
      )
        continue;
      const relation = getRelation(w, ally, enemy);
      if (relation.war || relation.allied) continue;
      const border = fronts.has(pairKey(ally, enemy));
      if (border)
        treaty(
          w,
          relation,
          "war",
          `${w.nations[defender - 1].name}과의 상호 방위 조약을 이행해 공동 전선에 합류했습니다.`,
          ally,
        );
    }
  }
}
export function validateDiplomacy(w: World) {
  if (w.diplomacyLog === undefined) return true;
  return (
    Array.isArray(w.diplomacyLog) &&
    w.diplomacyLog.length <= 800 &&
    Number.isSafeInteger(w.diplomacySequence) &&
    w.diplomacyLog.every(
      (e) =>
        e &&
        Number.isSafeInteger(e.id) &&
        Number.isFinite(e.year) &&
        e.year >= 0 &&
        Number.isInteger(e.a) &&
        e.a > 0 &&
        e.a <= w.nations.length &&
        Number.isInteger(e.b) &&
        e.b > 0 &&
        e.b <= w.nations.length &&
        e.a !== e.b &&
        Object.hasOwn(TREATY_LABELS, e.kind) &&
        typeof e.reason === "string" &&
        e.reason.length < 2000 &&
        (e.actor === undefined || e.actor === e.a || e.actor === e.b),
    )
  );
}
function regionalPolitics(w: World) {
  const border = new Set<string>(),
    adj = new Map<number, Set<number>>();
  for (let i = 0; i < w.tiles.length; i++) {
    const a = w.tiles[i].owner;
    if (!a) continue;
    for (const j of [i + 1, i + w.width]) {
      if (j >= w.tiles.length || (j === i + 1 && j % w.width === 0)) continue;
      const b = w.tiles[j].owner;
      if (!b || a === b) continue;
      border.add(`${Math.min(a, b)}:${Math.max(a, b)}`);
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
  }
  const alive = w.nations.filter((n) => n.alive),
    strength = (id: number) => {
      const n = w.nations[id - 1];
      return (
        Math.sqrt(n.population) *
        (1 + Math.sqrt(n.tech)) *
        (0.4 + n.stability * 0.6)
      );
    };
  const threat = (id: number) =>
    new Set(
      [...(adj.get(id) || [])].filter((other) => {
        const n = w.nations[other - 1],
          r = getRelation(w, id, other);
        const sample = n.samples.at(-4);
        return (
          r.war ||
          (n.aggression > 0.58 && strength(other) > strength(id) * 1.25) ||
          (sample && n.territory > sample.territory * 1.15 && n.territory > 20)
        );
      }),
    );
  const threats = new Map(alive.map((n) => [n.id, threat(n.id)]));
  for (let i = 0; i < alive.length; i++)
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i],
        b = alive[j],
        touch = border.has(`${a.id}:${b.id}`),
        common = [...threats.get(a.id)!].filter((id) =>
          threats.get(b.id)!.has(id),
        );
      const distance = Math.hypot(
        (a.capital % w.width) - (b.capital % w.width),
        Math.floor(a.capital / w.width) - Math.floor(b.capital / w.width),
      );
      if (
        !touch &&
        !(common.length && distance < w.width * 0.55) &&
        !(eraOf(a) >= 2 && eraOf(b) >= 2 && distance < w.width * 0.35)
      )
        continue;
      const r = getRelation(w, a.id, b.id);
      if (r.war) continue;
      const food = Math.min(
          a.food / Math.max(1, a.population),
          b.food / Math.max(1, b.population),
        ),
        expansion = (a.aggression + b.aggression) / 2;
      const metalA =
          w.life?.polities.find((p) => p.nation === a.id)?.metal || 0,
        metalB = w.life?.polities.find((p) => p.nation === b.id)?.metal || 0;
      const pressure = touch
        ? Math.max(0, Math.max(a.aggression, b.aggression) - 0.5) * 0.12 +
          Math.max(0, 0.6 - food) * 0.18 +
          (Math.min(metalA, metalB) < 2 && Math.max(eraOf(a), eraOf(b)) >= 5
            ? 0.025
            : 0)
        : 0;
      const difference =
        Math.abs(a.tech - b.tech) / Math.max(5, a.tech + b.tech);
      const target =
        0.35 +
        common.length * 0.35 -
        expansion * 0.48 -
        pressure * 3 -
        (r.grievance || 0) * 0.45 -
        (touch ? difference * 0.15 : 0) +
        (r.allied ? 0.25 : 0);
      r.score = Math.max(
        -1,
        Math.min(1, r.score + (target - r.score) * 0.08 - pressure),
      );
      if (common.length && !r.allied && r.score > 0.05 && w.year - r.since > 15)
        treaty(
          w,
          r,
          "alliance",
          `${common.map((id) => w.nations[id - 1].name).join(" · ")}의 팽창이라는 공동 위협에 대응해 상호 방위 조약을 체결했습니다.`,
        );
      if (
        touch &&
        !r.allied &&
        w.year - r.since > 150 &&
        r.score < -0.08 &&
        Math.max(a.aggression, b.aggression) > 0.58 &&
        Math.min(a.stability, b.stability) > 0.4
      ) {
        const actor = a.aggression > b.aggression ? a : b;
        treaty(
          w,
          r,
          "war",
          food < 0.6
            ? "식량·자원 압박과 국경 분쟁이 누적되어 개전했습니다."
            : "팽창 정책과 기술·세력 격차로 접경 경쟁이 무력 충돌로 번졌습니다.",
          actor.id,
        );
      }
      if (!r.war && r.score > 0.1) {
        a.wealth += 0.4;
        b.wealth += 0.4;
        const gap = (a.tech - b.tech) * 0.00001;
        if (gap > 0) advanceResearch(w, b, gap);
        else advanceResearch(w, a, -gap);
      }
    }
}
