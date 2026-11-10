import type { Nation, World } from "./engine";
import { adjacent, isWater } from "./geography";

export const faithPractice = [
  "성소에 형상을 허용합니다. 신앙과 성소가 자리 잡으면 농업 투자에 힘을 싣습니다.",
  "선조 석상을 세웁니다. 신앙과 성소가 자리 잡으면 공동 방위를 지지합니다.",
  "석상 대신 추모물을 세웁니다. 정착한 성소는 구휼과 농업 투자를 지지합니다.",
  "석상 대신 추모물을 세웁니다. 정착한 성소는 교역 협력을 지지합니다.",
  "석상 대신 추모물을 세웁니다. 정착한 성소는 연구를 후원합니다.",
];

export const civicRules = {
  granary: {
    name: "공동 비축",
    rule: "식량이 부족하면 국고를 농업과 관개에 먼저 씁니다.",
  },
  charter: {
    name: "항만 상인 헌장",
    rule: "운영 가능한 항구가 교역 투자를 우선시키고, 무력 갈등보다 교역 관계를 유지할 유인을 높입니다.",
  },
  levy: {
    name: "국경 방위 의무",
    rule: "전쟁 피해와 동원 압박이 방위 투자를 앞당기며 대외 경쟁에 더 민감해집니다.",
  },
  council: {
    name: "학술 후원 회의",
    rule: "교육 기반과 안정성이 충분하면 연구 투자를 더 쉽게 채택합니다.",
  },
  stewardship: {
    name: "지방 자치 관습",
    rule: "위기가 없을 때는 기존 지역 자원과 재정 여건에 따라 투자 우선순위를 정합니다.",
  },
} as const;
export type CivicRule = keyof typeof civicRules;

export function assessInstitutions(w: World, n: Nation, cells: number[]) {
  const cities = w.life?.settlements.filter((c) => c.nation === n.id) || [];
  const port = cities.some(
    (c) => c.urban?.port && (c.urban.operation ?? 1) > 0.2,
  );
  const education = cities.reduce(
    (s, c) => Math.max(s, c.urban?.education || 0),
    0,
  );
  const damage =
    cells.reduce((s, i) => s + w.tiles[i].damage, 0) /
    Math.max(1, cells.length);
  const war = w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id));
  const food = n.food / Math.max(1, n.population * 0.22);
  const rule: CivicRule =
    war || damage > 0.14
      ? "levy"
      : food < 1.1
        ? "granary"
        : port && (n.tendencies?.commerce ?? 0.2) > 0.16
          ? "charter"
          : education > 0.24 && n.stability > 0.48
            ? "council"
            : "stewardship";
  const basis =
    rule === "levy"
      ? war
        ? "진행 중인 전쟁"
        : `영토 평균 피해 ${Math.round(damage * 100)}%`
      : rule === "granary"
        ? `식량 비축 ${food.toFixed(1)}년분`
        : rule === "charter"
          ? "가동 중인 항구와 상업 투자 기반"
          : rule === "council"
            ? `교육 ${Math.round(education * 100)}% · 안정 ${Math.round(n.stability * 100)}%`
            : "긴급 식량·전쟁 압박과 특화 제도 요건이 낮음";
  const faithBias =
    n.culture &&
    n.culture.devotion >= 0.45 &&
    cities.some((c) => (c.urban?.temple || 0) > 0)
      ? (
          [
            "agriculture",
            "military",
            "agriculture",
            "commerce",
            "research",
          ] as const
        )[n.culture.faith]
      : undefined;
  return { rule, basis, faithBias };
}

export function architecture(w: World, n: Nation, tile = n.capital) {
  const here = w.tiles[tile],
    nearby = [tile, ...adjacent(w, tile)].map((i) => w.tiles[i]);
  if (
    (here.temperature !== undefined && here.temperature < 0.24) ||
    here.t === 5
  )
    return {
      style: 0,
      material: "wood",
      name: "급경사 지붕",
      reason: "추운 지방의 적설을 흘려보내는 높은 지붕",
    };
  if (here.biome === "arid")
    return {
      style: 4,
      material: "clay",
      name: "흙벽과 둥근 지붕",
      reason: "건조한 기후에서 흙벽의 두께로 일교차를 완화",
    };
  if (nearby.some((t) => t.damage > 0.28))
    return {
      style: 2,
      material: "stone",
      name: "석조 방어 도시",
      reason: "주변의 전투 피해에 대응해 방어 구조를 채택",
    };
  if (nearby.some((t) => isWater(t)))
    return {
      style: 1,
      material: "stone",
      name: "해안 테라스",
      reason: "해안의 개방된 공간과 항구 접근성을 살린 낮은 석조 구조",
    };
  const inherited = n.culture?.id ?? 0;
  return {
    style: inherited,
    material: nearby.some((t) => t.t === 3)
      ? "wood"
      : inherited === 4
        ? "clay"
        : "stone",
    name: ["목조 박공", "뜰과 회랑", "방어탑", "계단형 탑", "돔과 아치"][
      inherited
    ],
    reason: nearby.some((t) => t.t === 3)
      ? "전승된 형태와 주변 숲의 목재를 함께 사용"
      : "기존 문화권에서 물려받은 형태를 현지 재료로 유지",
  };
}
