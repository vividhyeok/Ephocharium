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
export function getRelation(w: World, a: number, b: number) {
  let r = w.relations.find(
    (r) => r.a === Math.min(a, b) && r.b === Math.max(a, b),
  );
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
  for (const r of [...w.relations]) {
    const a = w.nations[r.a - 1],
      b = w.nations[r.b - 1];
    if (!a?.alive || !b?.alive) {
      if (r.war) treaty(w, r, "peace", "교전국의 멸망으로 전쟁이 끝났습니다.");
      if (r.allied)
        treaty(w, r, "break", "동맹국의 멸망으로 조약이 종료되었습니다.");
      continue;
    }
    if (!r.war && !r.allied && r.score >= 0.55 && w.year - r.since >= 8)
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
    if (r.allied) {
      a.food += 0.8;
      b.food += 0.8;
      a.wealth += 0.35;
      b.wealth += 0.35;
      const gap = (a.tech - b.tech) * 0.0005;
      a.tech -= gap;
      b.tech += gap;
    }
  }
  // Allies with a real shared front can join a defensive war; no armies teleport.
  const active = w.relations.filter((r) => r.war && r.aggressor !== undefined);
  for (const war of active) {
    const defender = war.aggressor === war.a ? war.b : war.a;
    for (const pact of w.relations.filter(
      (r) => r.allied && (r.a === defender || r.b === defender),
    )) {
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
      const border = w.tiles.some(
        (t, i) =>
          t.owner === ally &&
          neighbors(w, i).some((j) => w.tiles[j].owner === enemy),
      );
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
