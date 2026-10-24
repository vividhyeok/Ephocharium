import { record, type World, type Nation } from "./engine";
import { eraOf } from "./eras";
import { hash } from "./geography";
import { consumeNation } from "./resources";
export const CULTURES = [
  {
    name: "루미아",
    roof: "gable",
    material: "wood",
    syllables: ["루", "미", "엘", "라", "벤", "리"],
    color: "#b77953",
  },
  {
    name: "에린",
    roof: "garden",
    material: "stone",
    syllables: ["에", "린", "아", "델", "세", "온"],
    color: "#819975",
  },
  {
    name: "노르딘",
    roof: "keep",
    material: "wood",
    syllables: ["노", "르", "딘", "하", "브", "가"],
    color: "#667b86",
  },
  {
    name: "세레니아",
    roof: "tower",
    material: "stone",
    syllables: ["세", "레", "니", "아", "벨", "티"],
    color: "#8b849e",
  },
  {
    name: "칼데아",
    roof: "dome",
    material: "clay",
    syllables: ["칼", "데", "아", "모", "사", "린"],
    color: "#bb9a62",
  },
] as const;
export const FAITHS = [
  { name: "강과 숲의 전통", images: true },
  { name: "선조의 길", images: true },
  { name: "하늘의 조화", images: false },
  { name: "빛의 성약", images: false },
  { name: "지혜의 학파", images: false },
];
export function culturalName(id: number, seed: number, part = 0) {
  const s = CULTURES[id % 5].syllables;
  return (
    s[Math.floor(hash(seed, part, 4) * s.length)] +
    s[Math.floor(hash(seed, part, 8) * s.length)] +
    s[Math.floor(hash(seed, part, 13) * s.length)]
  );
}
export function prepareCulture(w: World, n: Nation, legacy = false) {
  if (n.culture) return;
  const parent = n.parentId ? w.nations[n.parentId - 1]?.culture : undefined;
  const id =
    parent?.id ??
    Math.floor(
      hash(w.seed, n.capital % w.width, Math.floor(n.capital / w.width)) * 5,
    );
  const shares = parent ? [...parent.shares] : [0, 0, 0, 0, 0];
  if (!parent) shares[id] = 1;
  n.culture = {
    id,
    shares,
    faith: parent?.faith ?? id,
    cohesion: 0.6,
    devotion: 0.35,
    secular: 0.05,
    reignSince: w.year,
    general: culturalName(id, w.seed + n.id, 5),
    religiousLeader: culturalName(id, w.seed + n.id, 7),
    deeds: [],
    baseName: n.name.replace(
      / (왕국|공화국|제국|연맹|공국|성도국|상업 연맹)$/,
      "",
    ),
    official: "왕국",
    legacy,
  };
  if (!legacy) n.leader = culturalName(id, w.seed + n.id, 1);
}
export function blendCulture(w: World, a: number, b: number, amount: number) {
  const x = w.nations[a - 1]?.culture,
    y = w.nations[b - 1]?.culture;
  if (!x || !y) return;
  const old = [...x.shares];
  for (let i = 0; i < 5; i++) {
    x.shares[i] += (y.shares[i] - x.shares[i]) * amount;
    y.shares[i] += (old[i] - y.shares[i]) * amount;
  }
  if (y.devotion > x.devotion + 0.2 && amount > 0.002 && x.secular < 0.4)
    x.faith = y.faith;
}
export function updateCulture(w: World) {
  for (const n of w.nations.filter((n) => n.alive)) {
    prepareCulture(w, n);
    const c = n.culture!,
      cities = w.life!.settlements.filter((c) => c.nation === n.id),
      e = eraOf(n),
      war = w.relations.some((r) => r.war && (r.a === n.id || r.b === n.id));
    c.devotion = Math.max(
      0.05,
      Math.min(0.95, c.devotion + (war ? 0.0015 : 0.0002) - c.secular * 0.0003),
    );
    c.secular = Math.max(
      0,
      Math.min(0.8, c.secular + ((e >= 10 ? 0.0006 : 0) - (war ? 0.0002 : 0))),
    );
    c.cohesion = Math.max(
      0.1,
      Math.min(
        0.95,
        0.35 + c.devotion * 0.35 + c.secular * 0.15 + n.stability * 0.2,
      ),
    );
    n.stability = Math.min(1, n.stability + c.cohesion * 0.001);
    const official =
      c.secular > 0.5
        ? "공화국"
        : n.tendencies!.commerce > 0.3 && cities.some((c) => c.urban?.port)
          ? "상업 연맹"
          : c.devotion > 0.75 && cities.some((c) => (c.urban?.temple || 0) > 1)
            ? "성도국"
            : n.territory > w.tiles.length * 0.25 && e >= 3
              ? "제국"
              : w.life!.polities.find((p) => p.nation === n.id)?.regime ===
                  "republic"
                ? "공화국"
                : e < 2
                  ? "연맹"
                  : "왕국";
    for (const city of cities)
      if (city.urban)
        city.urban.influence = city.urban.influence.map(
          (v, i) => v + (c.shares[i] - v) * 0.01,
        );
    if (official !== c.official && w.year - c.reignSince > 30) {
      c.official = official;
      n.name = c.baseName + " " + official;
      record(w, n.name + " 국호 정비", [n.id], n.capital);
    }
    if (w.year % 24 !== n.id % 24) continue;
    for (const city of cities) {
      const u = city.urban!;
      if (!u || u.damage > 0.4 || city.population < 80 || n.wealth < 80)
        continue;
      const level = e >= 6 ? 3 : e >= 3 ? 2 : 1;
      if (
        u.temple < level &&
        c.devotion > 0.3 &&
        consumeNation(w, n, "stone", 3) &&
        consumeNation(w, n, "timber", 2)
      ) {
        u.temple++;
        n.wealth -= 30;
        const kind =
          u.temple === 1
            ? "temple"
            : FAITHS[c.faith].images
              ? "statue"
              : "memorial";
        w.living!.monuments.push({
          id: w.living!.nextId++,
          tile: city.tile,
          nation: n.id,
          culture: c.id,
          faith: c.faith,
          kind,
          year: w.year,
          condition: 1,
          reason:
            u.temple === 1
              ? "도시 공동체의 신앙과 결속이 성장해 건립"
              : war
                ? "전쟁 피해와 희생자를 기억하기 위해 건립"
                : "축적된 도시 자원과 문화 활동으로 건립",
        });
        record(
          w,
          city.name +
            "에 " +
            (kind === "statue"
              ? "선조 석상"
              : kind === "memorial"
                ? "추모 기념물"
                : "성소") +
            " 건립",
          [n.id],
          city.tile,
        );
        break;
      }
    }
  }
  for (const m of w.living!.monuments) {
    const owner = w.tiles[m.tile].owner;
    if (!w.nations[m.nation - 1]?.alive) m.kind = "ruin";
    m.condition = Math.max(
      0,
      m.condition - (w.tiles[m.tile].damage || 0) * 0.005 - 0.00003,
    );
    if (
      owner &&
      owner !== m.nation &&
      w.nations[owner - 1]?.wealth > 100 &&
      w.nations[owner - 1].stability > 0.65
    ) {
      m.preservedBy = owner;
      m.condition = Math.min(1, m.condition + 0.001);
    }
  }
  if (w.living!.monuments.length > 512)
    w.living!.monuments = w.living!.monuments.slice(-512);
}
