import { toolArt } from "./toolArt";
/** Original game artwork, generated locally from purpose-drawn silhouettes. */
const palette = [
  "#6e8a70",
  "#9a7755",
  "#c6b78b",
  "#e2d9b5",
  "#447381",
  "#879c9e",
  "#ad8059",
  "#d7bd70",
];
export function objectSvg(kind: string, size = 32) {
  const emblem = toolArt(kind, size);
  if (emblem) return emblem;
  let a = "";
  const r = (c: string, x: number, y: number, w: number, h: number) =>
    (a += `<rect fill="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  r("#153f3b33", 3, 26, 26, 3);
  if (["timber", "forest", "nature", "life"].includes(kind)) {
    r("#6c6744", 14, 10, 4, 17);
    r("#517955", 5, 8, 23, 12);
    r("#6f935c", 8, 3, 17, 16);
    r("#a2b277", 10, 4, 7, 5);
    if (kind === "timber") {
      r("#95714c", 6, 19, 22, 7);
      r("#d6b577", 6, 19, 5, 7);
      r("#8a6b46", 7, 21, 3, 3);
    }
  } else if (["food", "land", "farm", "population", "human"].includes(kind)) {
    if (kind === "human" || kind === "population") {
      for (const x of kind === "population" ? [6, 18] : [12]) {
        r("#bda47a", x, 5, 7, 7);
        r("#405c60", x - 1, 12, 9, 11);
        r("#d0bb8d", x, 4, 7, 3);
        r("#364c45", x, 23, 3, 5);
        r("#364c45", x + 5, 23, 3, 5);
      }
    } else {
      r("#8a754c", 3, 19, 27, 8);
      for (let x = 5; x < 29; x += 5) {
        r("#b8a269", x, 7, 2, 18);
        r("#d3c37c", x - 2, 7, 6, 3);
        r("#d3c37c", x - 1, 11, 4, 3);
      }
    }
  } else if (
    [
      "stone",
      "clay",
      "copper",
      "iron",
      "coal",
      "oil",
      "gold",
      "metal",
      "resource",
      "mine",
      "mountain",
    ].includes(kind)
  ) {
    const colors: Record<string, string> = {
      stone: "#8d9990",
      clay: "#bf8e68",
      copper: "#b37d56",
      iron: "#a4aba1",
      coal: "#405252",
      gold: "#d8b86b",
      metal: "#a8c1bc",
      resource: "#8daea6",
      mine: "#7e8d84",
      mountain: "#9fa899",
    };
    if (kind === "oil") {
      r("#475953", 8, 6, 17, 21);
      r("#6c8177", 8, 6, 17, 3);
      r("#d4b675", 9, 14, 15, 7);
      r("#405454", 14, 11, 5, 12);
    } else {
      r(colors[kind] || "#91a69c", 4, 18, 23, 9);
      r(colors[kind] || "#91a69c", 9, 8, 14, 17);
      r("#d2d8b4", 10, 9, 7, 4);
      r("#657875", 20, 15, 6, 11);
      r("#e3c88e", 7, 22, 5, 3);
    }
  } else if (
    ["sea", "ocean", "river", "flood", "rain", "ship", "port"].includes(kind)
  ) {
    for (let y = 16; y < 29; y += 4)
      r(y % 8 ? "#60969b" : "#7db0ab", 2, y, 28, 3);
    if (kind === "ship" || kind === "port") {
      r("#7c6247", 4, 15, 24, 7);
      r("#ae9063", 7, 22, 18, 3);
      r("#5a6450", 15, 3, 2, 15);
      r("#dfd3a5", 5, 5, 9, 10);
      r("#e8ddbd", 18, 4, 9, 11);
    } else {
      r("#d3d4aa", 3, 10, 8, 5);
      r("#6e8e6f", 3, 7, 8, 4);
    }
  } else if (
    ["rail", "train", "road", "transport", "industry"].includes(kind)
  ) {
    r("#4c6964", 2, 24, 29, 2);
    r("#c5b58b", 4, 27, 26, 2);
    r("#7a8271", 5, 12, 24, 11);
    r("#9ba78a", 10, 7, 10, 7);
    r("#3b5b5c", 12, 9, 6, 5);
    r("#b0bc94", 22, 14, 6, 7);
    r("#414b43", 7, 22, 5, 5);
    r("#414b43", 22, 22, 5, 5);
    r("#b3a776", 5, 4, 4, 10);
  } else if (["air", "plane", "world", "eye"].includes(kind)) {
    r("#cfd9bc", 3, 14, 27, 4);
    r("#e4debb", 14, 4, 5, 23);
    r("#7ca0a1", 21, 13, 5, 5);
    r("#b7b697", 6, 9, 3, 14);
  } else if (
    [
      "faith",
      "temple",
      "religion",
      "culture",
      "nation",
      "protect",
      "revolt",
    ].includes(kind)
  ) {
    r("#a8a98c", 4, 24, 25, 4);
    r("#d7d3a5", 8, 8, 18, 16);
    for (let x = 9; x < 26; x += 6) r("#748b7c", x, 13, 3, 11);
    r("#889b86", 6, 7, 22, 4);
    r("#b9c7a0", 10, 3, 14, 5);
    r("#d3b46d", 14, 1, 5, 4);
  } else if (
    ["war", "peace", "alliance", "army", "fire", "meteor", "plague"].includes(
      kind,
    )
  ) {
    r("#6d6c52", 5, 16, 10, 12);
    r("#c1b78c", 5, 8, 10, 9);
    r("#4b6361", 4, 5, 12, 5);
    r("#d4c78e", 22, 3, 3, 23);
    r(kind === "fire" || kind === "war" ? "#c78a5f" : "#96aa78", 20, 6, 8, 5);
    r("#3d5650", 5, 26, 4, 3);
    r("#3d5650", 12, 26, 4, 3);
  } else if (
    [
      "research",
      "health",
      "demography",
      "history",
      "save",
      "settings",
      "help",
      "aid",
    ].includes(kind)
  ) {
    r("#987e58", 5, 6, 23, 22);
    r("#d6cf9d", 7, 8, 19, 18);
    r("#8caa92", 10, 11, 13, 3);
    r("#b7b58b", 10, 17, 11, 2);
    r("#b7b58b", 10, 22, 8, 2);
    if (kind === "health") {
      r("#719985", 14, 11, 4, 12);
      r("#719985", 10, 15, 12, 4);
    }
  } else {
    const patterns: Record<string, number[][]> = {
      play: [
        [12, 6, 3, 21],
        [15, 9, 3, 15],
        [18, 12, 3, 9],
        [21, 15, 3, 3],
      ],
      pause: [
        [8, 7, 6, 20],
        [20, 7, 6, 20],
      ],
      plus: [
        [13, 5, 6, 24],
        [4, 14, 24, 6],
      ],
      minus: [[4, 14, 24, 6]],
      close: [
        [7, 7, 5, 5],
        [11, 11, 5, 5],
        [15, 15, 5, 5],
        [19, 19, 5, 5],
        [19, 7, 5, 5],
        [15, 11, 5, 5],
        [7, 19, 5, 5],
      ],
      fit: [
        [5, 5, 10, 4],
        [5, 5, 4, 10],
        [20, 5, 9, 4],
        [25, 5, 4, 10],
        [5, 24, 10, 4],
        [5, 19, 4, 9],
        [20, 24, 9, 4],
        [25, 19, 4, 9],
      ],
      inspect: [
        [11, 3, 9, 16],
        [8, 8, 3, 10],
        [20, 8, 3, 10],
        [9, 19, 16, 5],
        [12, 24, 4, 5],
      ],
      arrow: [
        [5, 13, 19, 5],
        [17, 7, 5, 5],
        [22, 12, 5, 7],
        [17, 20, 5, 5],
      ],
      chevron: [
        [10, 6, 5, 5],
        [15, 11, 5, 5],
        [20, 16, 5, 5],
        [15, 21, 5, 5],
      ],
      compass: [
        [13, 3, 6, 25],
        [4, 13, 24, 6],
      ],
      erase: [
        [6, 17, 20, 10],
        [10, 11, 16, 6],
      ],
    };
    for (const [x, y, w, h] of patterns[kind] || patterns.inspect)
      r("#c9c89b", x, y, w, h);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges">${a}</svg>`;
}
export interface SceneState {
  era: number;
  culture: number;
  farm?: number;
  mine?: number;
  industry?: number;
  port?: number;
  faith?: number;
  war?: number;
  research?: number;
  population?: number;
  river?: boolean;
  damage?: number;
}
export function skylineSvg(s: SceneState) {
  let a = "";
  const r = (c: string, x: number, y: number, w: number, h: number) =>
    (a += `<rect fill="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  r("#bac9af", 0, 0, 320, 144);
  r("#cbd1b3", 0, 70, 320, 74);
  for (let i = 0; i < 12; i++)
    r(
      i % 2 ? "#829b85" : "#96ad8b",
      i * 31 - 10,
      50 - (i % 3) * 9,
      35,
      34 + (i % 3) * 9,
    );
  r("#8d9e70", 0, 100, 320, 44);
  if (s.river || s.port) {
    r("#5b9196", s.port ? 185 : 0, 106, s.port ? 135 : 320, 38);
    r("#7fa9a1", s.port ? 187 : 0, 108, s.port ? 133 : 320, 4);
  }
  const density = Math.min(
    14,
    4 + Math.floor(Math.log2(1 + (s.population || 30))),
  );
  for (let i = 0; i < density; i++) {
    const x = 18 + ((i * 23) % 290),
      y = 108 - (i % 3) * 9,
      h = s.era >= 9 ? 24 + (i % 3) * 9 : s.era >= 7 ? 20 : 14 + (i % 3) * 4;
    const wall =
      s.culture === 4
        ? "#c8b284"
        : s.culture === 0 || s.culture === 2
          ? "#ad9168"
          : "#d2cfac";
    r("#5c725648", x - 2, y + 2, 22, 4);
    r(wall, x, y - h, 17, h);
    r("#768880", x + 13, y - h + 2, 4, h - 2);
    if (s.culture === 4) {
      r("#809385", x - 2, y - h - 3, 21, 4);
      r("#a5b094", x + 1, y - h - 6, 15, 4);
      r("#c3c7a1", x + 5, y - h - 9, 7, 4);
    } else if (s.culture === 3) {
      r("#c8c4a4", x + 4, y - h - 10, 9, 10);
      r("#7e8790", x + 3, y - h - 12, 11, 3);
    } else if (s.culture === 1) {
      r("#819b80", x - 2, y - h - 2, 21, 3);
      for (let j = 0; j < 3; j++)
        r("#8b9c83", x + 2 + j * 6, y - h + 3, 2, h - 4);
    } else {
      for (let j = 0; j < 4; j++)
        r(
          s.culture === 2 ? "#617e88" : "#a07353",
          x - 3 + j,
          y - h - 2 - j,
          23 - j * 2,
          2,
        );
    }
    r("#4e6963", x + 7, y - 8, 4, 8);
    for (let yy = y - h + 4; yy < y - 5; yy += 6)
      for (let xx = x + 3; xx < x + 15; xx += 7)
        r(s.era >= 8 ? "#b6c6aa" : "#d9ce95", xx, yy, 3, 3);
  }
  if (s.farm) {
    for (let row = 0; row < 3; row++) {
      r("#b6a46a", 5, 119 + row * 7, 110, 5);
      for (let x = 8; x < 110; x += 10) r("#d1c282", x, 117 + row * 7, 3, 6);
    }
  }
  if (s.mine) {
    r("#6c7e73", 18, 82, 35, 24);
    r("#3f5a54", 26, 90, 15, 16);
    r("#b09264", 24, 88, 20, 3);
    for (let i = 0; i < 4; i++)
      r("#a9af96", 11 + i * 9, 102 - (i % 2) * 4, 8, 6);
  }
  if (s.industry) {
    r("#9a896b", 125, 81, 48, 27);
    r("#697c70", 123, 78, 52, 5);
    r("#8b7c62", 160, 54, 6, 28);
    r("#b5b8a1", 161, 49, 9, 5);
    for (let i = 0; i < 4; i++) r("#d5bb76", 129 + i * 10, 88, 5, 7);
    r("#586e64", 113, 113, 78, 2);
    for (let x = 115; x < 190; x += 8) r("#a8a07b", x, 113, 3, 4);
  }
  if (s.port) {
    r("#a7a383", 190, 106, 90, 6);
    for (let x = 194; x < 278; x += 21) r("#7c7256", x, 109, 4, 13);
    r("#785f46", 226, 124, 48, 9);
    r("#d8cba1", 250, 95, 3, 30);
    r("#dfd8b3", 235, 97, 13, 24);
    r("#dfd8b3", 255, 99, 15, 22);
    if (s.era >= 7) {
      r("#8a9a83", 292, 71, 3, 39);
      r("#8a9a83", 273, 71, 22, 3);
      r("#8a9a83", 273, 72, 2, 17);
    }
  }
  if (s.faith) {
    r("#b4b394", 72, 84, 40, 30);
    r("#d5cfaa", 69, 81, 46, 5);
    for (let i = 0; i < 4; i++) r("#7e9582", 76 + i * 9, 89, 3, 25);
    r("#8b9f8c", 79, 74, 26, 8);
    r("#c5ca9f", 87, 67, 11, 8);
    r("#bcc3a0", 61, 93, 6, 20);
    r("#bcc3a0", 58, 88, 12, 7);
  }
  if (s.research || s.era >= 10) {
    r("#85a4a0", 172, 52, 3, 35);
    r("#c5d2b8", 168, 60, 11, 3);
    r("#c5d2b8", 171, 49, 5, 5);
  }
  if (s.era >= 12) {
    r("#d3d8bb", 284, 47, 5, 38);
    r("#8fa59b", 292, 50, 2, 36);
    r("#8fa59b", 287, 59, 7, 2);
  }
  if (s.war) {
    for (let i = 0; i < 5; i++) {
      r("#4b6863", 28 + i * 13, 130, 6, 8);
      r("#d2bd91", 29 + i * 13, 125, 4, 5);
      r("#a6aa8c", 35 + i * 13, 120, 2, 15);
    }
  }
  if ((s.damage || 0) > 0.3) {
    for (let i = 0; i < 8; i++)
      r("#627161", 30 + i * 31, 100 + (i % 3) * 5, 12, 7);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="432" viewBox="0 0 320 144" shape-rendering="crispEdges">${a}</svg>`;
}
