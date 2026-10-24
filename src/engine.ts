import {
  archiveYear,
  prepareArchive,
  validateArchive,
  type Archive,
  type LeaderTraits,
} from "./archives";
import { frontierYear } from "./frontier";
import { validateLiving } from "./livingValidation";
import { transportYear } from "./transport";
import { ensureLiving, urbanYear, reconcileLiving } from "./living";
import { buildGeography } from "./geography";
import { prepareCulture, culturalName, updateCulture } from "./culture";
import type {
  LivingState,
  Demography,
  Culture,
  Inventory,
  Material,
} from "./livingTypes";
import {
  validateProgress,
  prepareProgress,
  updateDirection,
  advanceResearch,
  updateIndustry,
  type Tendencies,
} from "./progression";
import { ERAS, eraOf, housingCapacity } from "./eras";
import {
  enrichEvent,
  captureAtlas,
  type Chronicle,
  type Atlas,
} from "./history";
import { nationName, nationColor } from "./identity";
import { coldPatch } from "./cartography";
import {
  treaty,
  updateDiplomacy,
  validateDiplomacy,
  type DiplomaticEvent,
} from "./diplomacy";
import {
  prepareLife,
  refreshLife,
  updateLife,
  researchRate,
  validateLife,
  type LifeState,
} from "./civilization";
export type Terrain = 0 | 1 | 2 | 3 | 4 | 5; // ocean, sand, grass, forest, mountain, snow
export type Preset = "empty" | "dawn" | "four" | "islands" | "war" | "observe";
export interface Tile {
  reclaimed?: boolean;
  irrigated?: boolean;
  baseFertility?: number;
  elevation?: number;
  spill?: number;
  downstream?: number;
  flow?: number;
  river?: number;
  depth?: number;
  lake?: boolean;
  moisture?: number;
  temperature?: number;
  biome?: string;
  deposits?: Partial<Inventory>;
  bridge?: boolean;
  tunnel?: boolean;
  rail?: number;
  mine?: Material;
  t: Terrain;
  owner: number;
  fertility: number;
  ore: number;
  damage: number;
  wood?: number;
  mineral?: number;
  road?: number;
}
export interface Nation {
  leaderTraits?: LeaderTraits;
  id: number;
  culture?: Culture;
  demography?: Demography;
  inventory?: Inventory;
  airSupport?: { tile: number; until: number };
  tendencies?: Tendencies;
  eraHistory?: { era: number; year: number }[];
  peakYear?: number;
  lastRevoltYear?: number;
  foundedYear?: number;
  parentId?: number;
  originalName?: string;
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
  allied?: boolean;
  allianceSince?: number;
  aggressor?: number;
  reason?: string;
  pastWars?: number;
  grievance?: number;
  pactYears?: number;
}
export interface History {
  id?: number;
  importance?: "major" | "normal";
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
  worldId?: string;
  archive?: Archive;
  version: 1;
  living?: LivingState;
  developmentSpeed?: "relaxed" | "standard" | "fast";
  progressRevision?: number;
  clockPhase?: number;
  renderRevision?: number;
  historySequence?: number;
  chronicle?: Chronicle[];
  atlases?: Atlas[];
  identityRevision?: number;
  cartographyRevision?: number;
  diplomacyLog?: DiplomaticEvent[];
  diplomacySequence?: number;
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
  life?: LifeState;
}
export interface Options {
  developmentSpeed?: "relaxed" | "standard" | "fast";
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
const land = (t: Tile) => t.t !== 0 && t.t !== 4 && t.t !== 5 && !t.lake;
export function record(
  w: World,
  text: string,
  nations: number[] = [],
  tile?: number,
) {
  prepareProgress(w);
  const event: History = { year: w.year, text, nations, tile };
  enrichEvent(w, event);
  w.history.push(event);
  if (w.history.length > 1200) w.history.shift();
}
export function found(
  w: World,
  tile: number,
  population = 24,
  parentId?: number,
) {
  if (!land(w.tiles[tile]) || w.tiles[tile].owner) return;
  const id = w.nations.length + 1;
  const n: Nation = {
    id,
    name: nationName(id),
    color: nationColor(id),
    foundedYear: w.year,
    peakYear: w.year,
    parentId,
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
  prepareCulture(w, n, false);
  if (!n.culture!.legacy) {
    let name = culturalName(n.culture!.id, w.seed + n.id, 2);
    if (w.nations.some((x) => x.id !== n.id && x.culture?.baseName === name))
      name += culturalName(n.culture!.id, n.id, 9);
    n.culture!.baseName = name;
    n.name = name + " 王国".replace("王国", "왕국");
  }
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
    size: clamp(Math.round(o.size) || 112, 16, 256),
  };
  const w: World = {
    version: 1,
    developmentSpeed: o.developmentSpeed || "standard",
    progressRevision: 4,
    clockPhase: 0,
    renderRevision: 0,
    historySequence: 0,
    chronicle: [],
    atlases: [],
    identityRevision: 2,
    cartographyRevision: 2,
    diplomacyLog: [],
    diplomacySequence: 0,
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
      h -= Math.max(0, 0.14 - Math.min(nx, 1 - nx, ny, 1 - ny)) * 13;
      const coast = (o.sea - 0.45) * 0.7;
      const r = random(w);
      let t: Terrain =
        x < 2 || y < 2 || x >= w.width - 2 || y >= w.height - 2 || h < coast
          ? 0
          : h < coast + 0.075
            ? 1
            : r < o.mountains && h > 0.25
              ? 4
              : coldPatch(w.seed, x, y, w.width, w.height) ||
                  (ny < 0.27 && h > 0.65 && r < 0.4)
                ? 5
                : r < o.forest
                  ? 3
                  : 2;
      w.tiles.push({
        t,
        elevation:
          t === 0 ? Math.min(-0.01, h - coast) : Math.max(0.02, h - coast),
        owner: 0,
        fertility: t === 2 ? 0.7 + random(w) * 0.3 : t === 3 ? 0.6 : 0.25,
        ore: random(w),
        damage: 0,
      });
    }
  ensureLiving(w, true);
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
      if (n && o.preset === "observe") {
        n.tech = 45 + random(w) * 60;
        n.eraHistory = [{ era: eraOf(n), year: w.year }];
        n.population = 350;
        n.food = 1200;
        n.wealth = 1800;
      }
    }
  }
  if (o.preset === "dawn" && candidates.length)
    w.settlers.push({
      tile: candidates[Math.floor(candidates.length / 2)],
      population: 20,
      progress: 0,
    });
  prepareLife(w);
  ensureLiving(w);
  refreshLife(w);
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
  return Math.max(0, n.territory / (72 + Math.sqrt(n.tech) * 120) - 1) * 0.006;
}
export function step(w: World) {
  prepareProgress(w);
  ensureLiving(w);
  prepareLife(w);
  w.year++;
  w.renderRevision = (w.renderRevision || 0) + 1;
  w.effects = w.effects.filter((e) => --e.life > 0);
  for (const s of [...w.settlers]) {
    s.progress += w.tiles[s.tile].fertility;
    if (s.progress >= 3) {
      found(w, s.tile, s.population);
      w.settlers.splice(w.settlers.indexOf(s), 1);
    }
  }
  prepareLife(w);
  const holdings = new Map<number, number[]>();
  w.tiles.forEach((t, i) => {
    if (t.damage > 0 && !w.living) t.damage = Math.max(0, t.damage - 0.025);
    if (t.owner) {
      if (!holdings.has(t.owner)) holdings.set(t.owner, []);
      holdings.get(t.owner)!.push(i);
    }
  });
  urbanYear(w, holdings);
  for (const n of w.nations.filter((n) => n.alive)) {
    const cells = holdings.get(n.id) || [];
    n.territory = cells.length;
    if (n.territory > n.peak) n.peakYear = w.year;
    n.peak = Math.max(n.peak, n.territory);
    updateDirection(w, n, cells);
    if (!cells.length || n.population < 2) {
      n.alive = false;
      for (const r of w.relations)
        if (r.a === n.id || r.b === n.id) {
          if (r.war)
            treaty(w, r, "peace", "교전국의 멸망으로 전쟁이 종료되었습니다.");
          if (r.allied) treaty(w, r, "break", "동맹국이 멸망했습니다.");
        }
      for (const i of cells) w.tiles[i].owner = 0;
      record(w, n.name + " 멸망", [n.id]);
      continue;
    }
    if (w.tiles[n.capital].owner !== n.id) n.capital = cells[0];
    const productive = cells.reduce(
      (a, i) => a + w.tiles[i].fertility * (1 - w.tiles[i].damage),
      0,
    );
    const effect = ERAS[eraOf(n)];
    const housing =
      w.life?.settlements
        .filter((c) => c.nation === n.id)
        .reduce((sum, c) => sum + c.homes * housingCapacity(n), 0) || 18;
    const capacity = Math.min(
      productive * (12 + Math.sqrt(n.tech) * 8) * effect.food,
      housing * 1.18 + productive * 2,
    );
    const production =
      productive *
      (3 + Math.sqrt(n.tech) * 1.5) *
      effect.food *
      (0.8 + (n.tendencies?.agriculture || 0.2));
    const fed = n.food > n.population * 0.25;
    advanceResearch(w, n, researchRate(w, n) * (0.9 + random(w) * 0.2));
    updateIndustry(w, n);
    n.stability = clamp(
      n.stability + (fed ? 0.008 : -0.025) - burden(n),
      0.02,
      1,
    );
    n.age += 1;
    if (
      n.age > 55 &&
      random(w) <
        Math.min(
          0.2,
          0.008 +
            Math.max(0, n.age - (n.demography?.adultLongevity || 75)) * 0.008,
        )
    ) {
      n.age = 20 + random(w) * 15;
      // National policy survives succession; personal traits are separate.
      n.leader = culturalName(n.culture!.id, w.seed + n.id + w.year, 1);
      n.culture!.reignSince = w.year;
      prepareArchive(w);
      record(w, n.name + "에 새로운 지도자가 즉위했습니다", [n.id], n.capital);
    }
    const frontier = cells
      .flatMap((i) => neighbors(w, i))
      .filter((i) => land(w.tiles[i]) && w.tiles[i].owner !== n.id);
    if (
      frontier.length &&
      n.population > cells.length * 2 &&
      n.wealth > 50 + eraOf(n) * 30
    ) {
      const i = frontier[Math.floor(random(w) * frontier.length)],
        t = w.tiles[i];
      if (!t.owner) {
        t.owner = n.id;
        n.wealth -= 2;
      }
    }
    if (
      n.stability < 0.22 &&
      cells.length > 120 &&
      n.population > 400 &&
      w.year - (n.lastRevoltYear ?? n.foundedYear ?? 0) > 150
    ) {
      n.lastRevoltYear = w.year;
      const far = cells.reduce((a, b) =>
        Math.abs(a - n.capital) > Math.abs(b - n.capital) ? a : b,
      );
      w.tiles[far].owner = 0;
      const rebel = found(w, far, n.population * 0.18, n.id);
      if (rebel) {
        rebel.tech = n.tech * 0.85;
        rebel.eraHistory = [{ era: eraOf(rebel), year: w.year }];
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
  updateDiplomacy(w);
  updateLife(w, holdings);
  frontierYear(w);
  transportYear(w);
  updateCulture(w);
  captureAtlas(w);
  archiveYear(w);
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
  alliance: {
    icon: "⚑",
    label: "동맹",
    description: "가까운 국가와 상호 방위·교류 조약을 체결합니다",
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
        treaty(w, r, "peace", "관찰자의 평화 중재로 휴전했습니다.");
        r.score = 0.4;
      }
    if (tool === "war" || tool === "alliance") {
      const other = w.nations
        .filter((n) => n.alive && n.id !== target.id)
        .sort(
          (a, b) =>
            Math.hypot(
              (a.capital % w.width) - (tile % w.width),
              Math.floor(a.capital / w.width) - Math.floor(tile / w.width),
            ) -
            Math.hypot(
              (b.capital % w.width) - (tile % w.width),
              Math.floor(b.capital / w.width) - Math.floor(tile / w.width),
            ),
        )[0];
      if (other) {
        const r = relation(w, target.id, other.id);
        if (tool === "alliance")
          treaty(
            w,
            r,
            "alliance",
            "관찰자의 중재로 상호 방위·자원 및 기술 교류 조약을 체결했습니다.",
          );
        else
          treaty(
            w,
            r,
            "war",
            "관찰자의 개입으로 전쟁을 선포했습니다.",
            target.id,
          );
        record(
          w,
          target.name +
            "과 " +
            other.name +
            (tool === "alliance" ? " 동맹 · 신의 개입" : " 전쟁 · 신의 개입"),
          [target.id, other.id],
          tile,
        );
      }
    }
    if (tool === "revolt") {
      w.tiles[tile].owner = 0;
      const n = found(w, tile, target.population * 0.15, target.id);
      if (n) {
        n.tech = target.tech * 0.85;
        n.eraHistory = [{ era: eraOf(n), year: w.year }];
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
        t.elevation =
          tool === "ocean" ? -0.2 : tool === "mountain" ? 0.9 : 0.35;
        t.baseFertility = t.fertility;
        t.lake = false;
        t.river = 0;
        if (!land(t)) t.owner = 0;
        t.wood = tool === "forest" ? 85 : 0;
        if (tool === "ocean") t.mineral = 0;
      }
      if (tool === "rain") {
        t.damage = 0;
        t.fertility = Math.min(1, t.fertility + 0.15);
      }
      if (tool === "resource") {
        t.ore = 1;
        t.mineral = 180;
        t.deposits = {
          stone: 180,
          iron: 160,
          coal: 140,
          copper: 80,
          clay: 80,
          oil: 60,
          gold: 20,
        };
      }
      if (["fire", "meteor", "flood"].includes(tool)) {
        t.damage = tool === "meteor" ? 1 : 0.8;
        if (t.owner) affected.add(t.owner);
        if (tool === "fire" && t.t === 3) t.t = 2;
        t.wood = (t.wood || 0) * 0.15;
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
  if (w.living) reconcileLiving(w);
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
    validateArchive(w) &&
    w.version === 1 &&
    Number.isInteger(w.width) &&
    w.width >= 16 &&
    w.width <= 320 &&
    Number.isInteger(w.height) &&
    w.height > 0 &&
    w.height <= 256 &&
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
        finite(t.damage, 0, 1) &&
        (t.wood === undefined || finite(t.wood)) &&
        (t.mineral === undefined || finite(t.mineral)) &&
        (t.road === undefined || finite(t.road, 0, 1)),
    ) &&
    Array.isArray(w.nations) &&
    w.nations.length < 100000 &&
    w.nations.every(
      (n, i) =>
        n &&
        n.id === i + 1 &&
        (n.foundedYear === undefined || finite(n.foundedYear)) &&
        (n.parentId === undefined || (id(n.parentId) && n.parentId !== n.id)) &&
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
        finite(r.since) &&
        (r.allied === undefined || typeof r.allied === "boolean") &&
        !(r.war && r.allied) &&
        (r.allianceSince === undefined || finite(r.allianceSince)) &&
        (r.aggressor === undefined ||
          r.aggressor === r.a ||
          r.aggressor === r.b) &&
        (r.reason === undefined ||
          (typeof r.reason === "string" && r.reason.length < 2000)),
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
    ["empty", "dawn", "four", "islands", "war", "observe"].includes(w.preset) &&
    validateLiving(w) &&
    validateProgress(w) &&
    validateDiplomacy(w) &&
    validateLife(w)
  );
}
