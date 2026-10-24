import { vessel } from "./vesselArt";
import type { World } from "./engine";
import { eraOf } from "./eras";
export function drawHydrology(ctx: CanvasRenderingContext2D, w: World) {
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i],
      x = (i % w.width) * 8 + 4,
      y = Math.floor(i / w.width) * 8 + 4;
    if (t.lake) {
      ctx.fillStyle = "#568c94";
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = "#81aaa5";
      ctx.fillRect(x - 3, y - 3, 5, 1);
    }
    if (t.river && t.downstream! >= 0) {
      const b = t.downstream!;
      ctx.strokeStyle = "#739e99";
      ctx.lineWidth = t.river * 2.5 + 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo((b % w.width) * 8 + 4, Math.floor(b / w.width) * 8 + 4);
      ctx.stroke();
      ctx.strokeStyle = "#4d8790";
      ctx.lineWidth = t.river * 1.8;
      ctx.stroke();
    }
    if (t.biome === "wetland" && i % 3 === 0) {
      ctx.fillStyle = "#6f9677";
      ctx.fillRect(x - 3, y, 5, 1);
    }
    if (t.bridge) {
      ctx.fillStyle = "#a9a07a";
      ctx.fillRect(x - 4, y - 2, 8, 4);
      ctx.fillStyle = "#67796c";
      ctx.fillRect(x - 4, y - 3, 8, 1);
      ctx.fillRect(x - 4, y + 2, 8, 1);
    }
    if ((t.rail || 0) > 0.3) {
      ctx.fillStyle = "#5e7167";
      ctx.fillRect(x - 4, y - 1, 8, 1);
      ctx.fillRect(x - 4, y + 2, 8, 1);
      ctx.fillStyle = "#b2a17a";
      for (let k = -3; k < 4; k += 3) ctx.fillRect(x + k, y - 2, 1, 5);
    }
  }
}
export function drawLivingFacilities(ctx: CanvasRenderingContext2D, w: World) {
  for (const c of w.life?.settlements || []) {
    if (!c.urban || c.urban.lifecycle==='ruin' || (c.urban.operation??1)<.15) continue;
    const u = c.urban,
      x = (c.tile % w.width) * 8 + 4,
      y = Math.floor(c.tile / w.width) * 8 + 4,
      n = w.nations[c.nation - 1];
    if (!n?.alive) continue;
    const r = (color: string, dx: number, dy: number, a: number, b: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + dx, y + dy, a, b);
    };
    if (u.roles.includes("mine")) {
      r("#66786b", -13, -2, 8, 7);
      r("#334d47", -11, 0, 4, 5);
      r("#b19b6c", -12, -1, 6, 1);
    }
    if (u.roles.includes("industry")) {
      r("#9d8466", 10, -7, 11, 10);
      r("#b6a67c", 12, -5, 2, 2);
      r("#b6a67c", 16, -5, 2, 2);
      r("#796e58", 18, -13, 2, 7);
    }
    if (u.station) {
      r("#c8c19b", -9, 10, 16, 5);
      r("#6a8279", -10, 9, 18, 2);
      r("#506b66", -6, 12, 3, 3);
    }
    if (u.port) {
      const p = u.portTile,
        px = (p % w.width) * 8 + 4,
        py = Math.floor(p / w.width) * 8 + 4;
      ctx.fillStyle = "#988e69";
      ctx.fillRect(px - 5, py - 1, 11, 3);
      ctx.fillStyle = "#bcb18a";
      ctx.fillRect(px - 3, py, 1, 5);
      ctx.fillRect(px + 3, py, 1, 5);
      if (eraOf(n) >= 7) {
        ctx.fillStyle = "#6f8e85";
        ctx.fillRect(px + 7, py - 12, 1, 15);
        ctx.fillRect(px + 2, py - 12, 6, 1);
      }
    }
    if (u.damage > 0.2) {
      r("#586e5f", -7, 1, 6, 3);
      r("#8c8970", 3, -2, 4, 5);
    }
  }
  for (const m of w.living?.monuments || []) {
    const x = (m.tile % w.width) * 8 + 4,
      y = Math.floor(m.tile / w.width) * 8 - 7;
    ctx.globalAlpha = Math.max(0.4, m.condition);
    ctx.fillStyle = m.kind === "ruin" ? "#8b9279" : "#c4c6a5";
    ctx.fillRect(x - 5, y + 1, 11, 3);
    if (m.kind === "statue") {
      ctx.fillRect(x - 1, y - 7, 3, 8);
      ctx.fillRect(x - 2, y - 10, 5, 4);
      ctx.fillRect(x - 4, y - 5, 9, 2);
    } else if (m.kind === "temple") {
      ctx.fillRect(x - 4, y - 6, 9, 7);
      ctx.fillStyle = "#7f9a86";
      ctx.fillRect(x - 5, y - 7, 11, 2);
      ctx.fillRect(x - 3, y - 9, 7, 2);
      ctx.fillStyle = "#536f65";
      ctx.fillRect(x - 1, y - 4, 3, 5);
    } else {
      ctx.fillRect(x - 2, y - 5, 5, 7);
      if (m.kind === "ruin") ctx.clearRect(x, y - 5, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
export function drawTransport(
  ctx: CanvasRenderingContext2D,
  w: World,
  alpha: number,
  zoom: number,
) {
  const s = w.living;
  if (!s) return;
  for (const v of s.vehicles) {
    if (v.path.length < 2) continue;
    let step = v.previousProgress + (v.progress - v.previousProgress) * alpha;
    let p: number, q: number, f: number;
    if (v.mode === "air") {
      const a = v.path[0],
        b = v.path.at(-1)!,
        length = Math.hypot(
          (a % w.width) - (b % w.width),
          Math.floor(a / w.width) - Math.floor(b / w.width),
        );
      p = a;
      q = b;
      f = Math.min(1, step / Math.max(1, length));
    } else {
      const index = Math.min(v.path.length - 2, Math.floor(step));
      p = v.path[index];
      q = v.path[index + 1];
      f = Math.min(1, step - index);
    }
    const x = ((p % w.width) + ((q % w.width) - (p % w.width)) * f) * 8 + 4,
      y =
        (Math.floor(p / w.width) +
          (Math.floor(q / w.width) - Math.floor(p / w.width)) * f) *
          8 +
        4;
    const matrix = ctx.getTransform();
    if (
      x * matrix.a + matrix.e < -60 ||
      x * matrix.a + matrix.e > ctx.canvas.width + 60 ||
      y * matrix.d + matrix.f < -60 ||
      y * matrix.d + matrix.f > ctx.canvas.height + 60
    )
      continue;
    const e = eraOf(w.nations[v.nation - 1]),
      color = w.nations[v.nation - 1].color;
    ctx.save();
    ctx.translate(x, y);
    if (q % w.width < p % w.width) ctx.scale(-1, 1);
    ctx.fillStyle = "#244d4550";
    ctx.fillRect(-5, 3, 11, 2);
    if (v.mode === "sea" || v.mode === "river") {
      vessel(ctx, e, color, v.purpose === "escort" || v.purpose === "landing");
    } else if (v.mode === "rail") {
      ctx.fillStyle = e >= 12 ? "#8cb9ae" : e >= 9 ? "#a8b9a5" : "#617b6d";
      ctx.fillRect(-6, -3, 14, 6);
      ctx.fillStyle = "#3e6263";
      ctx.fillRect(3, -2, 3, 3);
      ctx.fillStyle = "#bfb78a";
      ctx.fillRect(-5, 3, 3, 1);
      ctx.fillRect(4, 3, 3, 1);
      if (e < 9) {
        ctx.fillStyle = "#b1ad8a";
        ctx.fillRect(4, -7, 2, 4);
      }
    } else if (v.mode === "air") {
      ctx.fillStyle = "#e1dfbc";
      ctx.fillRect(-6, -1, 13, 2);
      ctx.fillRect(0, -6, 2, 12);
      ctx.fillRect(-4, -3, 1, 6);
      ctx.fillStyle = color;
      ctx.fillRect(-6, -1, 2, 2);
    } else if (v.purpose === "migration" || e < 7) {
      ctx.fillStyle = color;
      ctx.fillRect(-2, -2, 3, 5);
      ctx.fillStyle = "#d8c092";
      ctx.fillRect(-2, -5, 3, 3);
      ctx.fillStyle = "#7f7c58";
      ctx.fillRect(2, -1, 4, 3);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(-5, -2, 11, 5);
      ctx.fillStyle = "#a9beb0";
      ctx.fillRect(1, -4, 4, 3);
      ctx.fillStyle = "#37554c";
      ctx.fillRect(-4, 3, 2, 1);
      ctx.fillRect(3, 3, 2, 1);
    }
    ctx.restore();
  }
}
export function culturalRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  era: number,
  culture: number,
  material: string,
  variant: number,
) {
  if (era >= 9 && variant % 3 !== 0) return;
  const roof = era >= 9 ? -18 : -7;
  ctx.fillStyle =
    material === "clay"
      ? "#bea16e"
      : material === "wood"
        ? "#a2855e"
        : "#c4c5a7";
  if (culture === 4) {
    ctx.fillRect(x - 4, y + roof, 9, 3);
    ctx.fillRect(x - 3, y + roof - 2, 7, 2);
    ctx.fillRect(x - 1, y + roof - 3, 3, 1);
  } else if (culture === 3) {
    ctx.fillStyle = "#74848f";
    for (let k = 0; k < 3; k++)
      ctx.fillRect(x - 5 + k, y + roof - k * 2, 11 - k * 2, 1);
    ctx.fillRect(x, y + roof - 7, 1, 4);
  } else if (culture === 2) {
    ctx.fillRect(x - 5, y - 11, 2, 13);
    ctx.fillRect(x + 4, y - 11, 2, 13);
    ctx.fillRect(x - 5, y - 12, 1, 2);
    ctx.fillRect(x + 5, y - 12, 1, 2);
  } else if (culture === 1) {
    ctx.fillStyle = "#78967c";
    ctx.fillRect(x - 5, y + roof, 11, 2);
    ctx.fillRect(x - 6, y + 2, 4, 2);
    ctx.fillRect(x + 3, y + 2, 4, 2);
  } else {
    ctx.fillStyle = "#a47a55";
    for (let k = 0; k < 4; k++)
      ctx.fillRect(x - 5 + k, y + roof - k, 11 - k * 2, 1);
  }
}
