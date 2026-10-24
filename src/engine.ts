export type Terrain = 0 | 1 | 2 | 3 | 4 | 5; // ocean, sand, grass, forest, mountain, snow
export type Preset = "empty" | "dawn" | "four" | "islands" | "war" | "observe";
export interface Tile {
  t: Terrain;
  owner: number;
  fertility: number;
  ore: number;
  damage: number;
}
export interface Nation {
  id: number;
  name: string;
  color: string;
  capital: number;
  population: number;
  food: number;
  wealth: number;
  tech: number;
  stability: number;
  aggression: number;
  leader: string;
  age: number;
  territory: number;
  peak: number;
  alive: boolean;
  protected: boolean;
  samples: { year: number; population: number; territory: number }[];
}
export interface Relation {
  a: number;
  b: number;
  score: number;
  war: boolean;
  since: number;
}
export interface History {
  year: number;
  text: string;
  nations: number[];
  tile?: number;
}
export interface Effect {
  tile: number;
  kind: string;
  life: number;
}
export interface World {
  version: 1;
  seed: number;
  rng: number;
  width: number;
  height: number;
  year: number;
  tiles: Tile[];
  nations: Nation[];
  relations: Relation[];
  history: History[];
  settlers: { tile: number; population: number; progress: number }[];
  effects: Effect[];
  preset: Preset;
}
export interface Options {
  seed: number;
  size: number;
  sea: number;
  forest: number;
  mountains: number;
  preset: Preset;
}
export const COLORS = [
  "#efb968",
  "#72bbbd",
  "#d88da4",
  "#a7b971",
  "#ad9ad9",
  "#e78b65",
  "#83acd7",
  "#d5ce8c",
];
const NAMES = [
  "아르덴",
  "루미아",
  "벨로아",
  "에린",
  "세레니아",
  "노르딘",
  "아스텔",
  "미르",
];
export const random = (w: World) => {
  w.rng |= 0;
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), 1 | w.rng);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const neighbors = (w: World, i: number) =>
  [
    i % w.width ? i - 1 : -1,
    i % w.width < w.width - 1 ? i + 1 : -1,
    i - w.width,
    i + w.width,
  ].filter((n) => n >= 0 && n < w.tiles.length);
const land = (t: Tile) => t.t !== 0 && t.t !== 4 && t.t !== 5;
export function record(
  w: World,
  text: string,
  nations: number[] = [],
  tile?: number,
) {
  w.history.push({ year: w.year, text, nations, tile });
  if (w.history.length > 1200) w.history.shift();
}
export function found(w: World, tile: number, population = 24) {
  if (!land(w.tiles[tile]) || w.tiles[tile].owner) return;
  const id = w.nations.length + 1;
  const n: Nation = {
    id,
    name:
      NAMES[(id - 1) % 8] +
      (id > 8 ? " " + Math.ceil(id / 8) + "세" : "") +
      " 왕국",
    color: COLORS[(id - 1) % 8],
    capital: tile,
    population,
    food: population * 3,
    wealth: 40,
    tech: 0.1,
    stability: 0.85,
    aggression: 0.25 + random(w) * 0.65,
    leader: ["이안", "아린", "레온", "유나"][Math.floor(random(w) * 4)],
    age: 22,
    territory: 1,
    peak: 1,
    alive: true,
    protected: false,
    samples: [],
  };
  w.nations.push(n);
  w.tiles[tile].owner = id;
  for (const j of neighbors(w, tile))
    if (land(w.tiles[j]) && !w.tiles[j].owner) w.tiles[j].owner = id;
  record(w, n.name + " 건국", [id], tile);
  return n;
}
export function generate(o: Options): World {
  o = {
    ...o,
    seed: Number.isFinite(o.seed) ? o.seed | 0 : 0,
    size: clamp(Math.round(o.size) || 112, 16, 192),
  };
  const w: World = {
    version: 1,
    seed: o.seed,
    rng: o.seed,
    width: o.size,
    height: Math.round(o.size * 0.65),
    year: 0,
    tiles: [],
    nations: [],
    relations: [],
    history: [],
    settlers: [],
    effects: [],
    preset: o.preset,
  };
  const islands = Array.from(
    { length: o.preset === "islands" ? 13 : 7 },
    () => ({
      x: random(w),
      y: random(w),
      rx: 0.12 + random(w) * 0.22,
      ry: 0.18 + random(w) * 0.32,
    }),
  );
  const phase = random(w) * 10;
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) {
      const nx = x / w.width,
        ny = y / w.height;
      let h = -1;
      for (const a of islands)
        h = Math.max(h, 1 - Math.hypot((nx - a.x) / a.rx, (ny - a.y) / a.ry));
      h +=
        Math.sin(nx * 31 + Math.sin(ny * 23) + phase) * 0.065 +
        Math.cos(ny * 39 + nx * 15) * 0.045;
      const coast = (o.sea - 0.45) * 0.7;
      const r = random(w);
      let t: Terrain =
        h < coast
          ? 0
          : h < coast + 0.075
            ? 1
            : r < o.mountains && h > 0.25
              ? 4
              : ny < 0.13
                ? 5
                : r < o.forest
                  ? 3
                  : 2;
      w.tiles.push({
        t,
        owner: 0,
        fertility: t === 2 ? 0.7 + random(w) * 0.3 : t === 3 ? 0.6 : 0.25,
        ore: random(w),
        damage: 0,
      });
    }
  const count = { empty: 0, dawn: 0, four: 4, islands: 4, war: 6, observe: 5 }[
    o.preset
  ];
  const candidates = w.tiles
    .map((t, i) => (land(t) ? i : -1))
    .filter((i) => i >= 0);
  const starts: number[] = [];
  for (let k = 0; k < count; k++) {
    let best = candidates[0],
      score = -1;
    for (let a = 0; a < 180; a++) {
      const i = candidates[Math.floor(random(w) * candidates.length)];
      if (i === undefined) continue;
      const d = starts.length
        ? Math.min(
            ...starts.map((s) =>
              Math.hypot(
                (i % w.width) - (s % w.width),
                Math.floor(i / w.width) - Math.floor(s / w.width),
              ),
            ),
          )
        : random(w) * w.width;
      if (d > score) {
        score = d;
        best = i;
      }
    }
    if (best !== undefined) {
      starts.push(best);
      const n = found(w, best, o.preset === "observe" ? 180 : 50);
      if (n && o.preset === "war") n.aggression = 0.95;
    }
  }
  if (o.preset === "dawn" && candidates.length)
    w.settlers.push({
      tile: candidates[Math.floor(candidates.length / 2)],
      population: 20,
      progress: 0,
    });
  if (o.preset === "observe") for (let i = 0; i < 100; i++) step(w);
  return w;
}
function relation(w: World, a: number, b: number) {
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
    };
    w.relations.push(r);
  }
  return r;
}
export function burden(n: Nation) {
  return Math.max(0, n.territory / (48 + n.tech * 32) - 1) * 0.018;
}
export function step(w: World) {
  w.year++;
  w.effects = w.effects.filter((e) => --e.life > 0);
  for (const s of [...w.settlers]) {
    s.progress += w.tiles[s.tile].fertility;
    if (s.progress >= 3) {
      found(w, s.tile, s.population);
      w.settlers.splice(w.settlers.indexOf(s), 1);
    }
  }
  const holdings = new Map<number, number[]>();
  w.tiles.forEach((t, i) => {
    if (t.damage > 0) t.damage = Math.max(0, t.damage - 0.025);
    if (t.owner) {
      if (!holdings.has(t.owner)) holdings.set(t.owner, []);
      holdings.get(t.owner)!.push(i);
    }
  });
  for (const n of w.nations.filter((n) => n.alive)) {
    const cells = holdings.get(n.id) || [];
    n.territory = cells.length;
    n.peak = Math.max(n.peak, n.territory);
    if (!cells.length || n.population < 2) {
      n.alive = false;
      for (const r of w.relations)
        if (r.a === n.id || r.b === n.id) r.war = false;
      for (const i of cells) w.tiles[i].owner = 0;
      record(w, n.name + " 멸망", [n.id]);
      continue;
    }
    if (w.tiles[n.capital].owner !== n.id) n.capital = cells[0];
    const productive = cells.reduce(
      (a, i) => a + w.tiles[i].fertility * (1 - w.tiles[i].damage),
      0,
    );
    const capacity = productive * (12 + n.tech * 3);
    const production = productive * (3 + n.tech * 0.5);
    n.food = clamp(n.food + production - n.population * 0.22, 0, capacity * 4);
    const fed = n.food > n.population * 0.25;
    const growth = fed
      ? 0.022 * (1 - n.population / Math.max(10, capacity))
      : -0.035;
    n.population = Math.max(0, n.population * (1 + growth));
    n.wealth = Math.max(
      0,
      n.wealth +
        n.population * 0.035 -
        cells.length * 0.08 +
        cells.reduce(
          (total, i) =>
            total + w.tiles[i].ore * (1 - w.tiles[i].damage) * 0.025,
          0,
        ),
    );
    n.tech += Math.min(0.012, n.wealth / 100000) * (0.8 + random(w) * 0.4);
    n.stability = clamp(
      n.stability + (fed ? 0.008 : -0.025) - burden(n),
      0.02,
      1,
    );
    n.age += 0.25;
    if (n.age > 65 && random(w) < 0.025) {
      n.age = 20 + random(w) * 15;
      n.aggression = 0.2 + random(w) * 0.7;
      record(w, n.name + "에 새로운 지도자가 즉위했습니다", [n.id], n.capital);
    }
    const frontier = cells
      .flatMap((i) => neighbors(w, i))
      .filter((i) => land(w.tiles[i]) && w.tiles[i].owner !== n.id);
    if (frontier.length && n.population > cells.length * 2 && n.wealth > 2) {
      const i = frontier[Math.floor(random(w) * frontier.length)],
        t = w.tiles[i];
      if (!t.owner) {
        t.owner = n.id;
        n.wealth -= 2;
      } else {
        const other = w.nations[t.owner - 1];
        if (other?.alive) {
          const r = relation(w, n.id, other.id);
          r.score = clamp(
            r.score +
              (n.food < n.population ? -0.06 : 0.012) -
              n.aggression * 0.025,
            -1,
            1,
          );
          if (
            !r.war &&
            r.score < -0.25 &&
            n.aggression > 0.55 &&
            w.year - r.since > 18 &&
            n.stability > 0.4
          ) {
            r.war = true;
            r.since = w.year;
            record(
              w,
              n.name + "과 " + other.name + " 사이에 전쟁 발발",
              [n.id, other.id],
              i,
            );
          }
          if (r.war) {
            const attack =
              (n.population * (0.5 + n.tech) * n.stability) /
              Math.sqrt(cells.length);
            const defense =
              (other.population * (0.7 + other.tech) * other.stability) /
              Math.sqrt(Math.max(1, other.territory));
            if (
              !other.protected &&
              random(w) < (attack / (attack + defense)) * 0.3
            ) {
              t.owner = n.id;
              t.damage = 0.25;
              other.population *= 0.985;
              n.population *= 0.995;
              w.effects.push({ tile: i, kind: "전투", life: 3 });
              if (w.year % 5 === 0)
                record(w, n.name + "의 국경 점령", [n.id, other.id], i);
            }
            n.wealth = Math.max(0, n.wealth - 2);
            n.stability = Math.max(0.02, n.stability - 0.008);
            if (
              w.year - r.since > 15 &&
              (n.stability < 0.45 || other.stability < 0.45 || random(w) < 0.04)
            ) {
              r.war = false;
              r.score = 0.2;
              r.since = w.year;
              record(
                w,
                n.name + "과 " + other.name + " 평화협정",
                [n.id, other.id],
                i,
              );
            }
          } else if (r.score > 0.2) {
            n.food += 1;
            n.wealth += 0.6;
            n.tech += other.tech * 0.0002;
            if (r.score > 0.6 && r.score < 0.62)
              record(
                w,
                n.name + "과 " + other.name + " 교역 동맹",
                [n.id, other.id],
                i,
              );
          }
        }
      }
    }
    if (n.stability < 0.22 && cells.length > 24 && n.population > 100) {
      const far = cells.reduce((a, b) =>
        Math.abs(a - n.capital) > Math.abs(b - n.capital) ? a : b,
      );
      w.tiles[far].owner = 0;
      const rebel = found(w, far, n.population * 0.18);
      if (rebel) {
        n.population *= 0.82;
        n.stability += 0.25;
        for (const i of cells)
          if (
            Math.hypot(
              (i % w.width) - (far % w.width),
              Math.floor(i / w.width) - Math.floor(far / w.width),
            ) < 4
          )
            w.tiles[i].owner = rebel.id;
        record(
          w,
          n.name + "의 행정 위기, " + rebel.name + " 독립",
          [n.id, rebel.id],
          far,
        );
      }
    }
    if (w.year % 10 === 0) {
      n.samples.push({
        year: w.year,
        population: Math.round(n.population),
        territory: n.territory,
      });
      if (n.samples.length > 150) n.samples.shift();
    }
  }
}
export const TOOLS: Record<
  string,
  { icon: string; label: string; description: string; category: string }
> = {
  inspect: {
    icon: "⌖",
    label: "관찰",
    description: "국가를 선택해 이야기를 살펴봅니다",
    category: "생명",
  },
  human: {
    icon: "♟",
    label: "인간",
    description: "20명이 모여 자율적으로 정착합니다",
    category: "생명",
  },
  population: {
    icon: "♟♟",
    label: "인구 지원",
    description: "인구 100명 추가 · 식량 부족에 주의하세요",
    category: "생명",
  },
  erase: {
    icon: "✕",
    label: "생명 제거",
    description: "주변 국가의 인구를 줄입니다",
    category: "생명",
  },
  land: {
    icon: "▰",
    label: "평야",
    description: "비옥한 땅을 만듭니다",
    category: "지형",
  },
  ocean: {
    icon: "≈",
    label: "바다",
    description: "땅과 영토를 바다로 바꿉니다",
    category: "지형",
  },
  mountain: {
    icon: "▲",
    label: "산맥",
    description: "이동과 정착을 막는 산을 만듭니다",
    category: "지형",
  },
  forest: {
    icon: "♠",
    label: "숲",
    description: "자원이 풍부한 숲을 만듭니다",
    category: "지형",
  },
  rain: {
    icon: "☂",
    label: "비",
    description: "피해를 복구하고 토양을 비옥하게 합니다",
    category: "자연",
  },
  resource: {
    icon: "◆",
    label: "자원",
    description: "자원과 국가의 재산을 늘립니다",
    category: "자연",
  },
  fire: {
    icon: "♨",
    label: "화재",
    description: "숲과 문명에 피해를 줍니다",
    category: "재해",
  },
  meteor: {
    icon: "☄",
    label: "운석",
    description: "충돌 지역의 지형과 인구를 파괴합니다",
    category: "재해",
  },
  plague: {
    icon: "☠",
    label: "전염병",
    description: "국가 인구의 25%가 희생됩니다",
    category: "재해",
  },
  flood: {
    icon: "≋",
    label: "홍수",
    description: "농경지를 침수시켜 생산을 줄입니다",
    category: "재해",
  },
  nation: {
    icon: "⚑",
    label: "왕국",
    description: "새로운 독립 국가를 세웁니다",
    category: "문명",
  },
  aid: {
    icon: "✦",
    label: "축복",
    description: "식량과 재산을 지원합니다",
    category: "문명",
  },
  war: {
    icon: "⚔",
    label: "전쟁",
    description: "가장 가까운 국가와 전쟁을 시작합니다",
    category: "문명",
  },
  peace: {
    icon: "☮",
    label: "평화",
    description: "선택 국가의 모든 전쟁을 끝냅니다",
    category: "문명",
  },
  revolt: {
    icon: "⚐",
    label: "반란",
    description: "지역의 독립을 유도합니다",
    category: "문명",
  },
  protect: {
    icon: "♜",
    label: "보호",
    description: "정복 방지 보호를 켜거나 끕니다",
    category: "문명",
  },
};
export function apply(w: World, tool: string, tile: number, radius = 1) {
  if (!w.tiles[tile] || tool === "inspect") return;
  const target = w.nations[w.tiles[tile].owner - 1];
  if (["human", "nation"].includes(tool)) {
    if (land(w.tiles[tile]) && !w.tiles[tile].owner) {
      if (tool === "nation") found(w, tile, 30);
      else w.settlers.push({ tile, population: 20, progress: 0 });
    } else if (target) target.population += 20;
    return;
  }
  if (target) {
    if (tool === "population") target.population += 100;
    if (tool === "erase") target.population *= 0.5;
    if (tool === "aid") {
      target.food += 300;
      target.wealth += 200;
    }
    if (tool === "resource") target.wealth += 100;
    if (tool === "plague") target.population *= 0.75;
    if (tool === "protect") target.protected = !target.protected;
    if (tool === "peace")
      for (const r of w.relations.filter(
        (r) => r.a === target.id || r.b === target.id,
      )) {
        r.war = false;
        r.score = 0.4;
        r.since = w.year;
      }
    if (tool === "war") {
      const other = w.nations
        .filter((n) => n.alive && n.id !== target.id)
        .sort(
          (a, b) => Math.abs(a.capital - tile) - Math.abs(b.capital - tile),
        )[0];
      if (other) {
        const r = relation(w, target.id, other.id);
        r.war = true;
        r.since = w.year;
        record(
          w,
          target.name + "과 " + other.name + " 전쟁 · 신의 개입",
          [target.id, other.id],
          tile,
        );
      }
    }
    if (tool === "revolt") {
      w.tiles[tile].owner = 0;
      const n = found(w, tile, target.population * 0.15);
      if (n) {
        target.population *= 0.85;
        record(w, n.name + " 독립 · 신의 개입", [target.id, n.id], tile);
      }
    }
  }
  const affected = new Set<number>();
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y > radius * radius) continue;
      const xx = (tile % w.width) + x,
        yy = Math.floor(tile / w.width) + y;
      if (xx < 0 || xx >= w.width || yy < 0 || yy >= w.height) continue;
      const t = w.tiles[yy * w.width + xx];
      if (["land", "ocean", "mountain", "forest"].includes(tool)) {
        t.t = (
          { land: 2, ocean: 0, mountain: 4, forest: 3 } as Record<
            string,
            Terrain
          >
        )[tool];
        t.fertility = tool === "land" ? 0.9 : tool === "forest" ? 0.65 : 0.1;
        if (!land(t)) t.owner = 0;
      }
      if (tool === "rain") {
        t.damage = 0;
        t.fertility = Math.min(1, t.fertility + 0.15);
      }
      if (tool === "resource") t.ore = 1;
      if (["fire", "meteor", "flood"].includes(tool)) {
        t.damage = tool === "meteor" ? 1 : 0.8;
        if (t.owner) affected.add(t.owner);
        if (tool === "fire" && t.t === 3) t.t = 2;
        if (tool === "meteor") {
          t.t = 1;
          t.fertility = 0.15;
        }
      }
    }
  for (const id of affected) {
    const n = w.nations[id - 1];
    if (!n.protected) {
      n.population *= tool === "meteor" ? 0.7 : 0.9;
      n.food *= 0.7;
      n.wealth *= 0.8;
    }
  }
  if (["fire", "meteor", "flood", "plague"].includes(tool)) {
    w.effects.push({ tile, kind: tool, life: 8 });
    record(
      w,
      TOOLS[tool].label + " 발생 · 신의 개입",
      target ? [target.id] : [],
      tile,
    );
  }
}
export function validate(data: unknown): data is World {
  if (!data || typeof data !== "object") return false;
  const w = data as World;
  const finite = (v: unknown, min = 0, max = 1e12) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const tile = (v: unknown) =>
    Number.isInteger(v) && finite(v, 0, w.width * w.height - 1);
  const id = (v: unknown) =>
    Number.isInteger(v) && finite(v, 1, w.nations?.length || 0);
  return (
    w.version === 1 &&
    Number.isInteger(w.width) &&
    w.width >= 16 &&
    w.width <= 192 &&
    Number.isInteger(w.height) &&
    w.height > 0 &&
    w.height <= 192 &&
    Array.isArray(w.tiles) &&
    w.tiles.length === w.width * w.height &&
    w.tiles.every(
      (t) =>
        t &&
        Number.isInteger(t.t) &&
        t.t >= 0 &&
        t.t <= 5 &&
        Number.isInteger(t.owner) &&
        t.owner >= 0 &&
        finite(t.fertility, 0, 1) &&
        finite(t.ore, 0, 1) &&
        finite(t.damage, 0, 1),
    ) &&
    Array.isArray(w.nations) &&
    w.nations.length < 100000 &&
    w.nations.every(
      (n, i) =>
        n &&
        n.id === i + 1 &&
        typeof n.name === "string" &&
        n.name.length <= 100 &&
        typeof n.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(n.color) &&
        typeof n.leader === "string" &&
        n.leader.length <= 100 &&
        typeof n.alive === "boolean" &&
        typeof n.protected === "boolean" &&
        finite(n.food) &&
        finite(n.wealth) &&
        finite(n.stability, 0, 1) &&
        finite(n.aggression, 0, 1) &&
        finite(n.age) &&
        finite(n.territory) &&
        finite(n.peak) &&
        Number.isFinite(n.population) &&
        n.population >= 0 &&
        finite(n.tech) &&
        Array.isArray(n.samples) &&
        n.samples.length <= 150 &&
        n.samples.every(
          (s) =>
            s && finite(s.year) && finite(s.population) && finite(s.territory),
        ) &&
        Number.isInteger(n.capital) &&
        n.capital >= 0 &&
        n.capital < w.tiles.length,
    ) &&
    w.tiles.every((t) => t.owner <= w.nations.length) &&
    Array.isArray(w.relations) &&
    w.relations.length < 1000000 &&
    w.relations.every(
      (r) =>
        r &&
        id(r.a) &&
        id(r.b) &&
        r.a !== r.b &&
        finite(r.score, -1, 1) &&
        typeof r.war === "boolean" &&
        finite(r.since),
    ) &&
    Array.isArray(w.history) &&
    w.history.length <= 1200 &&
    w.history.every(
      (e) =>
        e &&
        finite(e.year) &&
        typeof e.text === "string" &&
        e.text.length <= 1000 &&
        Array.isArray(e.nations) &&
        e.nations.every(id) &&
        (e.tile === undefined || tile(e.tile)),
    ) &&
    Array.isArray(w.settlers) &&
    w.settlers.length < 100000 &&
    w.settlers.every(
      (s) => s && tile(s.tile) && finite(s.population) && finite(s.progress),
    ) &&
    Array.isArray(w.effects) &&
    w.effects.length < 100000 &&
    w.effects.every(
      (e) =>
        e &&
        tile(e.tile) &&
        typeof e.kind === "string" &&
        e.kind.length < 100 &&
        finite(e.life),
    ) &&
    Number.isInteger(w.rng) &&
    finite(w.rng, -2147483648, 2147483647) &&
    Number.isInteger(w.year) &&
    finite(w.year) &&
    Number.isInteger(w.seed) &&
    finite(w.seed, -2147483648, 2147483647) &&
    ["empty", "dawn", "four", "islands", "war", "observe"].includes(w.preset)
  );
}
