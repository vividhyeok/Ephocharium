import type { Nation } from "./engine";
// Every stage changes annual food, income, housing and transport, as well as art.
export const ERAS = [
  ["원시 부족", 0, "수렵·채집과 임시 거주", 1, 1, 9, 0.8],
  ["초기 농경", 0.8, "농지와 정착 · 식량 생산 증가", 1.18, 1.06, 11, 0.85],
  ["고대 도시", 2, "시장과 창고 · 교역 수입 증가", 1.3, 1.25, 14, 0.9],
  ["고대 왕국", 4, "성곽과 행정 · 주거·영토 수용 증가", 1.4, 1.35, 18, 1],
  ["고전 문명", 7, "광장과 수로 · 식량·도시 수용 증가", 1.55, 1.5, 24, 1.05],
  ["중세 문명", 11, "성채와 작업장 · 금속 가공 증가", 1.65, 1.65, 30, 1.1],
  ["근세 문명", 17, "학술원과 상업 · 교역·도시 경제 확대", 1.8, 1.9, 38, 1.2],
  ["산업 문명", 26, "공장과 포장도로 · 자원 가공·기계 운송", 2.2, 2.5, 65, 1.4],
  ["전기 문명", 40, "발전소와 전력망 · 전력 생산·산업 지원", 2.5, 3, 100, 1.55],
  ["현대 문명", 60, "고층 도시와 공항 · 차량·항공 교역", 2.8, 3.5, 210, 1.8],
  ["정보 문명", 90, "통신망과 연구소 · 지식 교류·연구 효율", 3, 4, 300, 2],
  ["자동화 문명", 135, "자동화 공장 · 재활용·생산 자동화", 3.5, 4.7, 420, 2.3],
  ["우주 문명", 200, "발사장과 위성 · 궤도 연구·통신 수입", 3.8, 5.4, 560, 2.6],
  [
    "행성간 문명",
    300,
    "융합 도시와 탐사 · 고효율 에너지·탐사 수입",
    4.4,
    6.2,
    750,
    3,
  ],
].map(([name, threshold, description, food, income, housing, mobility]) => ({
  name: String(name),
  threshold: Number(threshold),
  description: String(description),
  food: Number(food),
  income: Number(income),
  housing: Number(housing),
  mobility: Number(mobility),
}));
export const eraOf = (n: Pick<Nation, "tech">) =>
  ERAS.reduce((a, e, i) => (n.tech >= e.threshold ? i : a), 0);
export const equipmentEra = (n: Pick<Nation, "tech">) => {
  const e = eraOf(n);
  return e >= 10 ? 5 : e >= 9 ? 4 : e >= 7 ? 3 : e >= 3 ? 2 : e >= 1 ? 1 : 0;
};
export const housingCapacity = (n: Nation) =>
  ERAS[eraOf(n)].housing * (1 + Math.max(0, n.tech - 300) / 1000);
