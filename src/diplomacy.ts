import { prepareArchive, leaderTraits } from "./archives";
import { advanceResearch } from "./progression";
import { eraOf } from "./eras";
import { regionalPolitics, progressImperialRelations } from "./geopolitics";
import { record, neighbors, type World, type Relation } from "./engine";
export type TreatyKind = "war" | "peace" | "alliance" | "break" | "support" | "raid" | "subjugation" | "independence";
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
  raid: "식량·자원 약탈",
  subjugation: "종속국 수립",
  independence: "독립 선언",
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
  prepareArchive(w);
  if (kind === "war") {
    if (r.war) return;
    if (r.subject)
      treaty(w, r, "independence", "무력 충돌로 종속 관계가 파기되었습니다.", r.subject);
    if (r.allied)
      treaty(
        w,
        r,
        "break",
        "무력 충돌로 상호 방위 조약이 파기되었습니다.",
        actor,
      );
    w.archive!.lastWarStart = w.year;
    w.archive!.peaceSince = null;
    for (const id of [r.a, r.b]) w.archive!.nations[id].wars++;
    r.pastWars = (r.pastWars || 0) + 1;
    r.grievance = Math.min(1, (r.grievance || 0) + 0.35);
    r.war = true;
    r.allied = false;
    r.since = w.year;
    r.aggressor = actor;
    r.warStartTerritory = w.nations[(actor === r.a ? r.b : r.a) - 1]?.territory;
    r.expedition = undefined;
    r.reason = reason;
  }
  if (kind === "peace") {
    if (!r.war) return;
    r.war = false;
    w.archive!.lastWarEnd = w.year;
    if (!w.relations.some((other) => other !== r && other.war))
      w.archive!.peaceSince = w.year;
    r.score = Math.min(0.25, Math.max(-0.15, r.score));
    r.truceUntil = w.year + 36;
    r.since = w.year;
    r.reason = reason;
  }
  if (kind === "alliance") {
    if (r.allied || r.subject) return;
    if (r.war)
      treaty(
        w,
        r,
        "peace",
        "플레이어의 중재로 교전을 멈추고 동맹 협상을 시작했습니다.",
        actor,
      );
    for (const id of [r.a, r.b]) w.archive!.nations[id].alliances++;
    r.allied = true;
    r.allianceSince = w.year;
    r.score = Math.max(0.65, r.score);
    r.reason = reason;
  }
  if (kind === "break") {
    if (!r.allied) return;
    r.allied = false;
    r.truceUntil = w.year + 32;
    r.reason = reason;
  }
  if (kind === "subjugation") {
    if (!actor || (actor !== r.a && actor !== r.b) || r.subject) return;
    if (r.war)
      treaty(w, r, "peace", "전쟁 패배 후 종속 협정이 체결되었습니다.", actor);
    if (r.allied)
      treaty(w, r, "break", "종속 협정으로 기존 동맹이 종료되었습니다.", actor);
    r.subject = actor === r.a ? r.b : r.a;
    r.subjectSince = w.year;
    r.expedition = undefined;
    r.score = -0.38;
    r.grievance = Math.min(1, (r.grievance || 0) + 0.3);
    // A subordinated nation cannot keep sovereign defense commitments.
    for (const other of [...w.relations])
      if (other !== r && other.allied &&
          (other.a === r.subject || other.b === r.subject))
        treaty(w, other, "break", "종속 협정에 따라 기존 방위 동맹이 종료되었습니다.");
  }
  if (kind === "independence") {
    if (!r.subject) return;
    r.subject = undefined;
    r.subjectSince = undefined;
    r.score = -0.48;
    r.grievance = 0.7;
    r.truceUntil = w.year + 48;
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
    if (progressImperialRelations(w, r, a, b)) continue;
    r.grievance = Math.max(0, (r.grievance || 0) - 0.0006);
    if (r.war) {
      a.wealth = Math.max(0, a.wealth - 2);
      b.wealth = Math.max(0, b.wealth - 2);
      a.stability = Math.max(0.02, a.stability - 0.011);
      b.stability = Math.max(0.02, b.stability - 0.011);
      const invader = w.nations[(r.aggressor || r.a) - 1];
      const defender = invader.id === a.id ? b : a;
      if (r.aggressor && !defender.protected &&
          eraOf(invader) >= eraOf(defender) + 2 &&
          invader.population * (1 + Math.sqrt(invader.tech)) >
            defender.population * (1 + Math.sqrt(defender.tech)) * 1.7 &&
          w.year - r.since >= 14 &&
          defender.territory < (r.warStartTerritory || defender.territory) * 0.75)
        treaty(w, r, "subjugation",
          "영토를 잃은 약소국이 자치권 일부를 보장받고 조공국으로 종속되었습니다.",
          invader.id);
      else if (w.year - r.since > 25 &&
        (a.stability < 0.4 || b.stability < 0.4 || w.year - r.since > 45))
        treaty(w, r, "peace", "장기전의 보급 부담과 국내 피로로 휴전에 합의했습니다.");
    }
    if (r.allied) {
      r.pactYears = (r.pactYears || 0) + 1;
      // Defense treaties cannot create food out of nothing.
      a.wealth += 0.06;
      b.wealth += 0.06;
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
      if (relation.war || relation.allied || relation.subject) continue;
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
