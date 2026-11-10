import { assessInstitutions, civicRules, type CivicRule } from "./civic";
import { record, type World, type Nation } from "./engine";
import type { Direction } from "./progression";
export interface Strategy {
  year: number;
  priority: Direction;
  reason: string;
  foodYears: number;
  farmlandPerPerson: number;
  investment: number;
  institution?: { rule: CivicRule; basis: string };
  history: { year: number; priority: Direction; reason: string }[];
}
export function nationalStrategy(w: World, n: Nation, cells: number[]) {
  if (n.strategy && w.year - n.strategy.year < 12) return;
  const farmland = cells.reduce(
    (s, i) => s + w.tiles[i].fertility * (1 - w.tiles[i].damage),
    0,
  );
  const foodYears = n.food / Math.max(1, n.population * 0.22);
  const war = w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id));
  const capacity = n.demography?.capacity || n.population;
  const landPressure = n.population / Math.max(1, capacity);
  const scores: Record<Direction, number> = {
    agriculture:
      Math.max(0, 3 - foodYears) * 1.5 + Math.max(0, landPressure - 0.85) * 2,
    commerce: foodYears < 2 && n.wealth > n.population * 0.1 ? 2.6 : 0.5,
    military: war ? 3.6 : Math.max(0, n.aggression - 0.5),
    industry: (n.inventory?.metal || 0) < 5 && n.tech >= 4 ? 1.8 : 0.6,
    research: n.stability > 0.5 && foodYears > 2 ? 2.2 : 0.3,
  };
  const institution = assessInstitutions(w, n, cells);
  if (institution.rule === "granary") scores.agriculture += 0.8;
  if (institution.rule === "charter") scores.commerce += 1.4;
  if (institution.rule === "levy") scores.military += 1.1;
  if (institution.rule === "council") scores.research += 0.9;
  if (institution.faithBias) scores[institution.faithBias] += 0.35;
  const priority = (Object.keys(scores) as Direction[]).sort(
    (a, b) => scores[b] - scores[a],
  )[0];
  const reason =
    priority === "agriculture"
      ? `식량 비축 ${foodYears.toFixed(1)}년 · 부양 압력 ${Math.round(landPressure * 100)}% → 농업·관개 우선`
      : priority === "commerce"
        ? (foodYears < 2 && n.wealth > n.population * 0.1
            ? "곡물 부족과 구매 여력"
            : "가동 중인 교역 기반") + " → 교역·운송 우선"
        : priority === "military"
          ? (war
              ? "진행 중인 전쟁"
              : institution.rule === "levy"
                ? institution.basis
                : "방위 세력의 우선순위") + " → 방위·보급 우선"
          : priority === "industry"
            ? ((n.inventory?.metal || 0) < 5 && n.tech >= 4
                ? "가공 금속 부족"
                : "기초 생산 설비 유지") + " → 산업 우선"
            : (foodYears > 2 && n.stability > 0.5
                ? "식량 여유와 국정 안정"
                : "교육 기반과 연구 후원") + " → 연구 우선";
  const investment = Math.min(
    n.wealth * 0.015,
    Math.max(1, n.population * 0.025),
  );
  n.wealth = Math.max(0, n.wealth - investment);
  n.strategy = {
    year: w.year,
    priority,
    reason:
      reason +
      " · " +
      civicRules[institution.rule].name +
      ": " +
      institution.basis +
      (institution.faithBias === priority ? " · 성소 공동체의 후원" : ""),
    institution: { rule: institution.rule, basis: institution.basis },
    foodYears,
    farmlandPerPerson: farmland / Math.max(1, n.population),
    investment,
    history: [
      ...(n.strategy?.history || []),
      { year: w.year, priority, reason: reason + " · " + institution.basis },
    ].slice(-24),
  };
  if (n.strategy.history.at(-2)?.priority !== priority)
    record(w, `${n.name} 정책 전환 · ${n.strategy.reason}`, [n.id], n.capital);
}
export function policySupport(n: Nation, priority: Direction) {
  return n.strategy?.priority === priority
    ? Math.min(0.35, n.strategy.investment / Math.max(1, n.population * 0.03))
    : 0;
}
export function validateStrategy(n: Nation) {
  const s = n.strategy;
  if (!s) return true;
  const number = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1e12;
  const priorities = [
    "agriculture",
    "commerce",
    "military",
    "industry",
    "research",
  ];
  return (
    number(s.year) &&
    priorities.includes(s.priority) &&
    typeof s.reason === "string" &&
    s.reason.length <= 500 &&
    [s.foodYears, s.farmlandPerPerson, s.investment].every(number) &&
    (s.institution === undefined ||
      (s.institution &&
        Object.hasOwn(civicRules, s.institution.rule) &&
        typeof s.institution.basis === "string" &&
        s.institution.basis.length <= 200)) &&
    Array.isArray(s.history) &&
    s.history.length <= 24 &&
    s.history.every(
      (h) =>
        h &&
        number(h.year) &&
        priorities.includes(h.priority) &&
        typeof h.reason === "string" &&
        h.reason.length <= 500,
    )
  );
}
