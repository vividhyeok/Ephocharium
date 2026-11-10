import { record, type World, type Nation } from "./engine";
import type { Direction } from "./progression";
export interface Strategy {
  year: number;
  priority: Direction;
  reason: string;
  foodYears: number;
  farmlandPerPerson: number;
  investment: number;
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
  const priority = (Object.keys(scores) as Direction[]).sort(
    (a, b) => scores[b] - scores[a],
  )[0];
  const reason =
    priority === "agriculture"
      ? `식량 비축 ${foodYears.toFixed(1)}년 · 부양 압력 ${Math.round(landPressure * 100)}% → 농업·관개 우선`
      : priority === "commerce"
        ? `곡물 부족과 구매 가능한 재정 → 교역·운송 우선`
        : priority === "military"
          ? "실제 교전과 국경 위협 → 방위·보급 우선"
          : priority === "industry"
            ? "가공 금속 부족 → 채굴·산업 기반 우선"
            : "식량 여유와 안정된 국정 → 교육·연구 우선";
  const investment = Math.min(
    n.wealth * 0.015,
    Math.max(1, n.population * 0.025),
  );
  n.wealth = Math.max(0, n.wealth - investment);
  n.strategy = {
    year: w.year,
    priority,
    reason,
    foodYears,
    farmlandPerPerson: farmland / Math.max(1, n.population),
    investment,
    history: [
      ...(n.strategy?.history || []),
      { year: w.year, priority, reason },
    ].slice(-24),
  };
  if (n.strategy.history.at(-2)?.priority !== priority)
    record(w, `${n.name} 정책 전환 · ${reason}`, [n.id], n.capital);
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
