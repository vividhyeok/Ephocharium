import { hash } from "./geography";

type Landmass = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  angle: number;
  height: number;
};
function noise(seed: number, x: number, y: number, scale: number) {
  const gx = x * scale,
    gy = y * scale,
    ix = Math.floor(gx),
    iy = Math.floor(gy);
  const u = (gx - ix) ** 2 * (3 - 2 * (gx - ix)),
    v = (gy - iy) ** 2 * (3 - 2 * (gy - iy));
  return (
    ((hash(seed, ix, iy) * (1 - u) + hash(seed, ix + 1, iy) * u) * (1 - v) +
      (hash(seed, ix, iy + 1) * (1 - u) + hash(seed, ix + 1, iy + 1) * u) * v) *
      2 -
    1
  );
}

export function oceanicTerrain(
  seed: number,
  width: number,
  height: number,
  sea: number,
  archipelago = false,
) {
  const random = (n: number) => hash(seed, n, 427);
  const flip = random(0) > 0.5 ? -1 : 1;
  const tilt = (random(1) - 0.5) * 0.45;
  const lobes: Landmass[] = [
    {
      x: 0.27,
      y: 0.47 + flip * 0.08,
      rx: 0.24,
      ry: 0.36,
      angle: tilt - 0.36 * flip,
      height: 1.04,
    },
    {
      x: 0.72,
      y: 0.5 - flip * 0.08,
      rx: 0.23,
      ry: 0.36,
      angle: tilt + 0.47 * flip,
      height: 1.02,
    },
  ];
  if (!archipelago) {
    lobes.push(
      {
        x: 0.35,
        y: 0.29 + flip * 0.08,
        rx: 0.17,
        ry: 0.2,
        angle: tilt + 0.7,
        height: 0.74,
      },
      {
        x: 0.65,
        y: 0.68 - flip * 0.08,
        rx: 0.17,
        ry: 0.21,
        angle: tilt - 0.7,
        height: 0.76,
      },
    );
  } else {
    lobes[0].rx = 0.19;
    lobes[0].ry = 0.26;
    lobes[1].rx = 0.19;
    lobes[1].ry = 0.27;
  }
  for (let i = 0; i < (archipelago ? 12 : 7); i++) {
    const side = i % 2;
    lobes.push({
      x: side
        ? 0.6 + random(10 + i * 5) * 0.32
        : 0.08 + random(10 + i * 5) * 0.32,
      y: 0.13 + random(11 + i * 5) * 0.74,
      rx: 0.034 + random(12 + i * 5) * 0.055,
      ry: 0.048 + random(13 + i * 5) * 0.075,
      angle: random(14 + i * 5) * 2,
      height: archipelago ? 0.8 : 0.64,
    });
  }
  const shapes = lobes.map((a) => ({
    ...a,
    cos: Math.cos(a.angle),
    sin: Math.sin(a.angle),
  }));
  const field = new Float64Array(width * height),
    candidates: number[] = [];
  for (let i = 0; i < field.length; i++) {
    const x = i % width,
      y = Math.floor(i / width),
      nx = (x + 0.5) / width,
      ny = (y + 0.5) / height;
    const strait =
      0.5 + flip * 0.07 * (ny - 0.5) + 0.023 * Math.sin(ny * 9 + random(2) * 6);
    const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
    if (edge || (sea >= 0.55 && Math.abs(nx - strait) < 0.029)) {
      field[i] = -0.6;
      continue;
    }
    const wx = nx + noise(seed + 17, nx, ny, 5) * 0.04,
      wy = ny + noise(seed + 19, nx, ny, 5) * 0.047;
    let h = -1;
    for (const a of shapes) {
      const dx = wx - a.x,
        dy = wy - a.y;
      h = Math.max(
        h,
        a.height -
          Math.hypot(
            (dx * a.cos - dy * a.sin) / a.rx,
            (dx * a.sin + dy * a.cos) / a.ry,
          ),
      );
    }
    field[i] =
      h +
      noise(seed + 23, nx, ny, 11) * 0.13 +
      noise(seed + 29, nx, ny, 24) * 0.065 +
      noise(seed + 31, nx, ny, 48) * 0.023;
    candidates.push(i);
  }
  candidates.sort((a, b) => field[b] - field[a] || a - b);
  const ratio = Number.isFinite(sea)
    ? Math.max(0.05, Math.min(0.85, sea))
    : 0.68;
  const landCount = Math.min(
    candidates.length,
    Math.round(field.length * (1 - ratio)),
  );
  const coast = field[candidates[landCount - 1]] ?? 0;
  const land = new Uint8Array(field.length);
  for (let rank = 0; rank < landCount; rank++) land[candidates[rank]] = 1;
  for (let i = 0; i < field.length; i++)
    field[i] = land[i]
      ? Math.max(0.004, field[i] - coast)
      : Math.min(-0.004, field[i] - coast);
  return field;
}
