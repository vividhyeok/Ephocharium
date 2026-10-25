import { consumeNation, stockNation } from "./resources";
import { enrichEvent } from "./history";
import type { World, Nation } from "./engine";
import { ERAS, eraOf } from "./eras";
export const DIRECTIONS = {
  agriculture: "농업",
  commerce: "상업",
  industry: "산업",
  research: "연구",
  military: "군사",
} as const;
export type Direction = keyof typeof DIRECTIONS;
export type Tendencies = Record<Direction, number>;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function prepareProgress(w: World) {
  if (w.progressRevision !== 4) {
    const old = [0, 0.55, 1.6, 3.4, 5.5, 7.5],
      mapped = [0, 0.8, 4, 26, 60, 90];
    for (const n of w.nations) {
      let k = old.reduce((a, t, i) => (n.tech >= t ? i : a), 0);
      k = Math.max(0, k);
      n.tech =
        k === 5
          ? 90 + Math.log1p(n.tech - 7.5) * 12
          : mapped[k] +
            ((n.tech - old[k]) / (old[k + 1] - old[k])) *
              (mapped[k + 1] - mapped[k]);
    }
    if (w.life) {
      for (const p of w.life.polities) p.era = eraOf(w.nations[p.nation - 1]);
      for (const c of w.life.settlements)
        c.development = [0, 1, 3, 7, 9, 10][
          Math.min(5, Math.floor(c.development))
        ];
    }
    w.progressRevision = 4;
    w.historySequence = 0;
    w.chronicle = [];
    for (const event of w.history) enrichEvent(w, event, false);
  }
  for (const n of w.nations) {
    n.tendencies ??= {
      agriculture: 0.2,
      commerce: 0.2,
      industry: 0.2,
      research: 0.2,
      military: 0.2,
    };
    n.eraHistory ??= [{ era: eraOf(n), year: w.year }];
  }
  w.chronicle ??= [];
  w.atlases ??= [];
  w.historySequence ??= 0;
  w.renderRevision ??= 0;
}
export function updateDirection(w: World, n: Nation, cells: number[]) {
  const p = w.life?.polities.find((p) => p.nation === n.id),
    t = n.tendencies!;
  const fertile =
      cells.reduce((a, i) => a + w.tiles[i].fertility, 0) /
      Math.max(1, cells.length),
    ore =
      cells.reduce((a, i) => a + w.tiles[i].ore, 0) / Math.max(1, cells.length);
  const relations = w.relations.filter((r) => r.a === n.id || r.b === n.id),
    war = relations.some((r) => r.war) ? 1 : 0,
    trade = relations.filter((r) => r.allied || r.score > 0.3).length;
  const target: Tendencies = {
    agriculture: 0.2 + fertile * 0.6 + (n.food < n.population ? 0.5 : 0),
    commerce:
      0.15 +
      trade * 0.2 +
      Math.min(0.6, n.wealth / Math.max(1, n.population * 30)),
    industry: 0.15 + ore * 0.6 + (p?.energy || 0) * 0.15,
    research: 0.15 + n.stability * 0.5 + trade * 0.1,
    military: 0.15 + war * 0.8 + n.aggression * 0.3,
  };
  const sum = Object.values(target).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(t) as Direction[])
    t[k] += (target[k] / sum - t[k]) * 0.008;
}
/** Education, specialists and international exchange support capable small nations. */
export function effectiveWorkforce(w: World, n: Nation) {
  const cities = w.life?.settlements.filter((c) => c.nation === n.id && c.urban) || [];
  const residents = cities.reduce((sum, c) => sum + c.population, 0);
  const education = cities.reduce((sum, c) =>
    sum + c.population * (c.urban?.education || 0), 0) / Math.max(1, residents);
  const imported = cities.reduce((sum, c) => sum + (c.urban?.imported || 0), 0);
  const allies = w.relations.filter((r) => r.allied && (r.a === n.id || r.b === n.id)).length;
  return n.population * (1 + Math.min(0.7, education * 0.75 + Math.log1p(imported) * 0.09)) +
    Math.min(48, allies * 12);
}
export function developmentGate(w: World, n: Nation) {
  const e = eraOf(n),
    next = ERAS[e + 1];
  if (!next) return "";
  const population = [
    0, 20, 40, 70, 110, 160, 220, 300, 420, 600, 850, 1200, 1700, 2200,
  ][e + 1];
  if (effectiveWorkforce(w, n) < population)
    return `인구·교육·교역 기반 부족 (${Math.floor(effectiveWorkforce(w, n))}/${population})`;
  if (n.stability < 0.38) return "안정성 회복 필요";
  if (n.wealth < 20 * (e + 1)) return "연구를 지원할 재산 필요";
  const p = w.life?.polities.find((p) => p.nation === n.id);
  if (e >= 7 && (p?.energy || 0) < (e - 6) * 0.25) return "전력 기반 확충 필요";
  return "";
}
export function researchRate(w: World, n: Nation) {
  const p = w.life?.polities.find((p) => p.nation === n.id),
    e = eraOf(n),
    war = w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id));
  const minimumStaff = [
    0, 10, 20, 35, 55, 80, 110, 150, 210, 300, 425, 600, 850, 1100,
  ][e];
  const workforce = effectiveWorkforce(w, n);
  if (workforce < minimumStaff)
    return -Math.max(0.001, n.tech * 0.0008) * (1 - workforce / minimumStaff);
  if (n.stability < 0.24 || n.food < n.population * 0.1)
    return -Math.min(0.035, n.tech * 0.00018) * (war ? 1.5 : 1);
  if (
    ERAS[e + 1] &&
    n.tech >= ERAS[e + 1].threshold - 0.00001 &&
    developmentGate(w, n)
  )
    return 0;
  const economy = clamp(
      Math.log1p(n.wealth / Math.max(100, n.population)) / 3,
      0.1,
      1.6,
    ),
    population = clamp(Math.log2(1 + n.population) / 10, 0.2, 1.5),
    resources = clamp(((p?.wood || 0) + (p?.metal || 0) * 2) / 100, 0.1, 1.3);
  const exchange = w.relations.filter(
    (r) => r.allied && (r.a === n.id || r.b === n.id),
  ).length;
  const cities =
    w.life?.settlements.filter((c) => c.nation === n.id && c.population > 0) ||
    [];
  const education =
    cities.reduce((s, c) => s + (c.urban?.education || 0) * c.population, 0) /
    Math.max(
      1,
      cities.reduce((s, c) => s + c.population, 0),
    );
  const tradeVolume =
    w.living?.routes
      .filter((r) => cities.some((c) => c.id === r.from || c.id === r.to))
      .reduce((s, r) => s + r.delivered, 0) || 0;
  const institutions =
    1 + education * 2 + Math.min(0.4, Math.log1p(tradeVolume) * 0.03);
  return (
    (((w.developmentSpeed === "relaxed"
      ? 0.55
      : w.developmentSpeed === "fast"
        ? 1.8
        : 1) *
      0.045 *
      institutions *
      (0.25 + economy * 0.3 + population * 0.25 + resources * 0.2) *
      (0.5 + n.stability * 0.5) *
      (n.food > n.population * 0.25 ? 1 : 0.25) *
      (0.65 + (n.tendencies?.research || 0.2) * 2) *
      (1 + Math.min(0.6, exchange * 0.12)) *
      (1 + Math.min(0.3, (p?.satellites || 0) * 0.015))) /
      (1 + Math.pow(n.tech / 110, 0.75))) *
    (war ? 0.65 : 1)
  );
}
export function advanceResearch(w: World, n: Nation, amount: number) {
  const next = ERAS[eraOf(n) + 1];
  n.tech = Math.max(0.05, n.tech + amount);
  if (
    next &&
    n.tech >= next.threshold &&
    developmentGate(w, { ...n, tech: next.threshold - 0.00001 })
  )
    n.tech = next.threshold - 0.000001;
}
export function updateIndustry(w: World, n: Nation) {
  const p = w.life!.polities.find((p) => p.nation === n.id)!;
  const e = eraOf(n),
    cities = w.life!.settlements.filter((c) => c.nation === n.id);
  p.energy ??= 0;
  p.satellites ??= 0;
  p.probes ??= 0;
  const investment =
    n.wealth > 30 && n.food > n.population * 0.15 && n.stability > 0.3;
  const target = e >= 8 ? (e - 7) * 0.7 + n.tech * 0.005 : e >= 7 ? 0.35 : 0;
  if (w.living) {
    const growth = investment
      ? 0.005 * (0.5 + Math.min(2, (n.inventory?.metal || 0) / 20))
      : -0.01;
    for (const c of cities) {
      c.industry = Math.max(
        0,
        Math.min(
          1 + (e - 7) * 0.3,
          (c.industry || 0) +
            (e >= 7 &&
            investment &&
            (c.urban?.operation ?? 1) > 0.3 &&
            consumeNation(w, n, "metal", 0.008)
              ? growth
              : -0.01),
        ),
      );
      c.network = Math.max(
        0,
        Math.min(
          e >= 10 ? 1 + (e - 10) * 0.4 : 0,
          (c.network || 0) + (e >= 10 && investment ? 0.006 : -0.003),
        ),
      );
      n.wealth += (c.network || 0) * 0.25;
    }
    if (
      e >= 12 &&
      investment &&
      (p.energy || 0) > 1 &&
      (p.satellites || 0) < Math.floor((n.tech - 190) / 10) &&
      consumeNation(w, n, "metal", 12)
    ) {
      p.satellites = (p.satellites || 0) + 1;
      n.wealth = Math.max(0, n.wealth - 100);
    }
    if (
      e >= 13 &&
      investment &&
      (p.probes || 0) < Math.floor((n.tech - 290) / 20) &&
      consumeNation(w, n, "metal", 25)
    ) {
      p.probes = (p.probes || 0) + 1;
      n.wealth = Math.max(0, n.wealth - 300);
    }
    n.wealth += (p.satellites || 0) * 0.1 + (p.probes || 0) * 0.4;
    stockNation(w, n);
    return;
  }
  p.energy = clamp(
    p.energy + (investment ? 0.008 : -0.012) * (1 + e * 0.1),
    0,
    target,
  );
  if (e >= 5 && investment) {
    const recycling = e >= 11 ? 0.12 : e >= 7 ? 0.035 : 0.008;
    p.metal += cities.length * recycling * (1 + (n.tendencies?.industry || 0));
    n.wealth = Math.max(0, n.wealth - cities.length * recycling * 0.5);
  }
  if (e >= 8 && p.energy > 0) {
    n.wealth += cities.length * p.energy * 0.18;
    n.food += cities.length * p.energy * 0.1;
  }
  for (const c of cities) {
    c.industry ??= 0;
    c.network ??= 0;
    c.industry = clamp(
      c.industry + (investment ? 0.006 : -0.01),
      0,
      e >= 7 ? 1 + (e - 7) * 0.3 : 0.15,
    );
    c.network = clamp(
      c.network + (investment && e >= 10 ? 0.008 : -0.004),
      0,
      e >= 10 ? 1 + (e - 10) * 0.4 : 0,
    );
    n.wealth += c.network * 0.25 + c.industry * 0.18 * (1 + p.energy * 0.1);
  }
  if (e >= 12 && investment && p.metal > 12 && n.wealth > 500 && p.energy > 1) {
    const limit = Math.floor((n.tech - 190) / 10);
    if (p.satellites < limit) {
      p.satellites++;
      p.metal -= 12;
      n.wealth -= 100;
    }
  }
  if (
    e >= 13 &&
    investment &&
    p.metal > 25 &&
    n.wealth > 1000 &&
    p.probes < Math.floor((n.tech - 290) / 20)
  ) {
    p.probes++;
    p.metal -= 25;
    n.wealth -= 300;
  }
  n.wealth += p.satellites * 0.1 + p.probes * 0.4;
}
export function validateProgress(w: World) {
  const number = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e12;
  if (w.progressRevision !== undefined && w.progressRevision !== 4)
    return false;
  if (
    w.clockPhase !== undefined &&
    (!number(w.clockPhase) || w.clockPhase >= 40)
  )
    return false;
  if (w.renderRevision !== undefined && !number(w.renderRevision)) return false;
  if (
    w.historySequence !== undefined &&
    (!Number.isSafeInteger(w.historySequence) || w.historySequence < 0)
  )
    return false;
  if (
    !w.nations.every(
      (n) =>
        (n.tendencies === undefined ||
          (Object.keys(n.tendencies).length === 5 &&
            Object.keys(DIRECTIONS).every(
              (k) =>
                number(n.tendencies![k as Direction]) &&
                n.tendencies![k as Direction] <= 1,
            ))) &&
        (n.eraHistory === undefined ||
          (Array.isArray(n.eraHistory) &&
            n.eraHistory.length <= 100 &&
            n.eraHistory.every(
              (e) =>
                e &&
                Number.isInteger(e.era) &&
                e.era >= 0 &&
                e.era < ERAS.length &&
                number(e.year),
            ))) &&
        (n.peakYear === undefined || number(n.peakYear)),
    )
  )
    return false;
  if (
    w.chronicle !== undefined &&
    (!Array.isArray(w.chronicle) ||
      w.chronicle.length > 120 ||
      !w.chronicle.every(
        (c) =>
          c &&
          [
            "from",
            "to",
            "major",
            "events",
            "foundings",
            "falls",
            "wars",
            "advances",
          ].every((k) => number(c[k as keyof typeof c])),
      ))
  )
    return false;
  if (
    w.atlases !== undefined &&
    (!Array.isArray(w.atlases) ||
      w.atlases.length > 8 ||
      !w.atlases.every(
        (a) =>
          a &&
          number(a.year) &&
          a.width === w.width &&
          a.height === w.height &&
          Array.isArray(a.owners) &&
          a.owners.length <= w.tiles.length * 2 &&
          a.owners.length % 2 === 0 &&
          a.owners.every(
            (v, i) =>
              Number.isInteger(v) &&
              v >= 0 &&
              (i % 2 ? v > 0 : v <= w.nations.length),
          ) &&
          a.owners.filter((_, i) => i % 2).reduce((s, n) => s + n, 0) ===
            w.tiles.length,
      ))
  )
    return false;
  return w.history.every(
    (e) =>
      (e.importance === undefined ||
        e.importance === "major" ||
        e.importance === "normal") &&
      (e.id === undefined ||
        (Number.isSafeInteger(e.id) &&
          e.id > 0 &&
          e.id <= (w.historySequence || 0))),
  );
}
