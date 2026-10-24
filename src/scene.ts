import { equipmentEra } from "./eras";
import { pixelPerson } from "./PixelPerson";
import type { World } from "./engine";
import { eraOf, type Citizen, type Settlement } from "./civilization";
const coordinates = (w: World, tile: number) => ({
  x: (tile % w.width) * 8 + 4,
  y: Math.floor(tile / w.width) * 8 + 4,
});
const houseOffsets = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-2, 0],
  [2, 0],
  [0, 2],
  [0, -2],
  [-2, 1],
  [2, 1],
  [-1, 2],
  [1, 2],
  [2, -1],
];
function legacyBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  era: number,
  color: string,
  variant: number,
  capital = false,
) {
  ctx.fillStyle = "#3a563e40";
  ctx.fillRect(x - 2, y + 1, 8, 3);
  if (era === 0) {
    ctx.fillStyle = "#b78d60";
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.lineTo(x, y - 5);
    ctx.lineTo(x + 4, y + 2);
    ctx.fill();
    ctx.fillStyle = "#e3c99b";
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.lineTo(x, y - 5);
    ctx.lineTo(x + 1, y + 2);
    ctx.fill();
    ctx.fillStyle = "#66513b";
    ctx.fillRect(x, y - 1, 1, 3);
    return;
  }
  if (era <= 2) {
    ctx.fillStyle = era === 2 ? "#d9d6bd" : "#e7d3a4";
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = "#b8b895";
    ctx.fillRect(x + 1, y - 2, 3, 5);
    ctx.fillStyle = era === 2 ? "#697f80" : "#b57850";
    ctx.fillRect(x - 4, y - 4, 8, 2);
    ctx.fillRect(x - 3, y - 5, 6, 1);
    ctx.fillStyle = "#5c5546";
    ctx.fillRect(x - 1, y, 2, 3);
    ctx.fillStyle = "#f6e8b4";
    ctx.fillRect(x - 2, y - 2, 1, 1);
    ctx.fillRect(x + 2, y - 2, 1, 1);
    if (capital && era === 2) {
      for (const off of [-5, 4]) {
        ctx.fillStyle = "#d6d4b9";
        ctx.fillRect(x + off, y - 7, 3, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x + off, y - 8, 3, 2);
        ctx.fillStyle = "#666e61";
        ctx.fillRect(x + off + 1, y - 4, 1, 2);
      }
    }
    return;
  }
  if (era === 3 && variant % 3 === 0) {
    ctx.fillStyle = "#bd9771";
    ctx.fillRect(x - 4, y - 4, 9, 7);
    ctx.fillStyle = "#87765f";
    ctx.fillRect(x - 4, y - 5, 9, 2);
    ctx.fillRect(x + 2, y - 10, 2, 7);
    ctx.fillStyle = "#f3d484";
    ctx.fillRect(x - 3, y - 2, 2, 2);
    ctx.fillRect(x, y - 2, 2, 2);
    ctx.fillStyle = "#66736b";
    ctx.fillRect(x + 2, y - 11, 3, 1);
    return;
  }
  const h = era >= 4 ? 12 + (variant % 3) * 4 : 6;
  ctx.fillStyle = era >= 4 ? "#d4ddd3" : "#d7c6a4";
  ctx.fillRect(x - 3, y - h, 6, h + 3);
  ctx.fillStyle = era >= 4 ? "#8fa9aa" : "#b2a987";
  ctx.fillRect(x + 1, y - h + 1, 3, h + 2);
  ctx.fillStyle = era >= 4 ? "#587d88" : "#737e76";
  ctx.fillRect(x - 3, y - h - 1, 7, 2);
  for (let yy = y - h + 2; yy < y; yy += 3) {
    ctx.fillStyle = variant % 2 ? "#efd9a2" : "#618e9a";
    ctx.fillRect(x - 2, yy, 1, 1);
    ctx.fillRect(x, yy, 1, 1);
    ctx.fillRect(x + 2, yy, 1, 1);
  }
  ctx.fillStyle = "#607678";
  ctx.fillRect(x - 1, y, 2, 3);
  if (capital) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - h - 2, 7, 1);
  }
}
export function building(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  era: number,
  color: string,
  variant: number,
  capital = false,
) {
  const base = [0, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5][era] ?? 5;
  legacyBuilding(ctx, x, y, base, color, variant, capital);
  const r = (c: string, dx: number, dy: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  if (era === 2) {
    r("#a4885b", -5, 0, 10, 2);
    r("#d8b967", -5, -5, 3, 2);
  }
  if (era === 3) {
    r("#b8bcad", -5, -8, 2, 10);
    r("#b8bcad", 4, -8, 2, 10);
    r(color, -5, -9, 2, 2);
  }
  if (era === 4) {
    r("#e4ddbe", -5, -8, 10, 2);
    for (let i = 0; i < 3; i++) r("#c8c6a7", -4 + i * 3, -6, 1, 7);
  }
  if (era === 5) {
    r("#626b78", -4, -8, 8, 3);
    r("#aeb8b0", -5, -11, 2, 12);
    r(color, -5, -12, 3, 2);
  }
  if (era === 6) {
    r("#8ba59c", -4, -9, 8, 3);
    r("#d9c693", -2, -11, 4, 2);
    r("#d9c693", 0, -13, 1, 3);
  }
  if (era === 7) {
    r("#806c59", 3, -12, 2, 9);
    r("#a7aaa0", 3, -14, 3, 2);
  }
  if (era === 8) {
    r("#b8c2b2", -5, -10, 10, 3);
    r("#d9bb67", -2, -8, 1, 5);
    r("#d9bb67", -3, -5, 3, 1);
    r("#707e7b", 5, -13, 1, 16);
    r("#d8d5b1", 3, -11, 5, 1);
  }
  if (era === 9) {
    r("#e2e6d6", -4, -19, 8, 2);
    r("#84a2a5", 3, -17, 2, 18);
  }
  if (era === 10) {
    r("#8cbbc2", -4, -20, 8, 3);
    r("#d3e4d8", 0, -26, 1, 7);
    r("#8cbbc2", -2, -24, 5, 1);
  }
  if (era === 11) {
    r("#b3c8b6", -5, -12, 10, 13);
    r("#3f6668", -4, -10, 8, 6);
    r("#84c2b6", -3, -9, 2, 2);
    r("#84c2b6", 1, -9, 2, 2);
    r("#97b1a6", 5, -8, 3, 1);
    r("#97b1a6", 7, -8, 1, 6);
  }
  if (era === 12) {
    r("#6b8183", -5, -3, 11, 5);
    r("#e2e4d3", -1, -20, 3, 17);
    r("#d4ba7c", -2, -3, 5, 2);
    r("#adbeb4", 4, -18, 1, 19);
    r("#adbeb4", 2, -13, 4, 1);
    r(color, -1, -16, 3, 2);
  }
  if (era === 13) {
    r("#81aba8", -5, -12, 10, 12);
    r("#a8d2bb", -4, -15, 8, 4);
    r("#c1ded0", -2, -17, 4, 3);
    r("#355c63", -3, -10, 6, 8);
    r("#a7d1b2", -1, -9, 2, 6);
    r("#c9dba9", -5, 0, 11, 2);
  }
}
export function drawInfrastructure(ctx: CanvasRenderingContext2D, w: World) {
  const s = w.life;
  if (!s) return;
  w.tiles.forEach((t, i) => {
    const { x, y } = coordinates(w, i);
    if (t.t !== 0 && (t.mineral || 0) > 1 && t.ore > 0.79) {
      ctx.fillStyle = "#647d7940";
      ctx.fillRect(x - 2, y + 1, 6, 2);
      ctx.fillStyle = t.ore > 0.92 ? "#91b4bd" : "#8e9690";
      ctx.fillRect(x - 3, y - 1, 3, 3);
      ctx.fillRect(x, y - 2, 3, 4);
      ctx.fillStyle = t.ore > 0.92 ? "#d2e3df" : "#d2b57d";
      ctx.fillRect(x + 1, y - 2, 1, 2);
      ctx.fillRect(x - 2, y, 1, 1);
    }
    if (!t.owner || (t.road || 0) < 0.15) return;
    const n = w.nations[t.owner - 1];
    if (!n) return;
    ctx.strokeStyle = eraOf(n) >= 7 ? "#9a9c8b" : "#d1bf86";
    ctx.lineWidth = eraOf(n) >= 3 ? 2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 2, y);
    for (const j of [i - 1, i + 1, i - w.width, i + w.width])
      if (
        w.tiles[j]?.owner === t.owner &&
        (w.tiles[j].road || 0) > 0.15 &&
        Math.abs((j % w.width) - (i % w.width)) <= 1
      ) {
        const b = coordinates(w, j);
        ctx.moveTo(x, y);
        ctx.lineTo(b.x, b.y);
      }
    ctx.stroke();
    const p = s.polities.find((p) => p.nation === n.id);
    if (eraOf(n) >= 8 && (p?.energy || 0) > 0.2 && i % 9 === 0) {
      ctx.fillStyle = "#6a7c78";
      ctx.fillRect(x + 2, y - 6, 1, 8);
      ctx.fillRect(x, y - 5, 5, 1);
      ctx.fillStyle = "#e9d5a3";
      ctx.fillRect(x, y - 5, 1, 1);
    }
  });
  for (const c of s.settlements) {
    const n = w.nations[c.nation - 1];
    if (!n?.alive || w.tiles[c.tile].owner !== n.id) continue;
    const era = Math.min(eraOf(n), Math.floor(c.development)),
      p = coordinates(w, c.tile);
    ctx.fillStyle = era >= 7 ? "#b7b7a17a" : "#caba857a";
    ctx.fillRect(p.x - 5, p.y - 4, 10, 10);
    const structures =
      era >= 7
        ? Math.min(
            18,
            Math.max(
              c.homes,
              2 +
                Math.floor(Math.log2(1 + c.population)) +
                (c.industry || 0) * 2,
            ),
          )
        : c.homes;
    let count = 0;
    for (const [dx, dy] of houseOffsets) {
      const tx = (c.tile % w.width) + dx,
        ty = Math.floor(c.tile / w.width) + dy,
        i = ty * w.width + tx;
      if (
        tx < 0 ||
        tx >= w.width ||
        ty < 0 ||
        ty >= w.height ||
        w.tiles[i].owner !== n.id
      )
        continue;
      building(
        ctx,
        tx * 8 + 4,
        ty * 8 + 4,
        era,
        n.color,
        count,
        count === 0 && c.tile === n.capital,
      );
      if (++count >= structures) break;
    }
    if (era >= 1) {
      for (const [dx, dy] of [
        [-2, -1],
        [2, -1],
        [-1, 2],
      ]) {
        const i = c.tile + dx + dy * w.width;
        if (w.tiles[i]?.owner === n.id && w.tiles[i].t === 2) {
          const b = coordinates(w, i);
          ctx.fillStyle = "#c8ab65";
          ctx.fillRect(b.x - 3, b.y - 2, 7, 5);
          ctx.fillStyle = "#8c9e52";
          for (let k = 0; k < 3; k++)
            ctx.fillRect(b.x - 2 + k * 2, b.y - 2, 1, 5);
        }
      }
    }
    if (era === 0) {
      ctx.fillStyle = "#805d3e";
      ctx.fillRect(p.x + 4, p.y + 2, 3, 1);
      ctx.fillStyle = "#f1b758";
      ctx.fillRect(p.x + 5, p.y, 1, 2);
    }
    if (c.airport) {
      const airport = airportPoint(w, c);
      ctx.fillStyle = "#637c79";
      ctx.fillRect(airport.x - 12, airport.y - 3, 25, 7);
      ctx.fillStyle = "#d7ddbd";
      for (let k = -9; k <= 9; k += 5)
        ctx.fillRect(airport.x + k, airport.y, 3, 1);
      ctx.fillStyle = "#e0e6d6";
      ctx.fillRect(airport.x - 6, airport.y - 7, 8, 3);
      ctx.fillStyle = "#86a3a6";
      ctx.fillRect(airport.x + 3, airport.y - 10, 2, 7);
      ctx.fillStyle = "#f1d99a";
      ctx.fillRect(airport.x + 2, airport.y - 11, 4, 2);
    }
    ctx.fillStyle = "#f1deb0";
    ctx.fillRect(p.x - 1, p.y - 13, 1, 7);
    ctx.fillStyle = n.color;
    ctx.fillRect(p.x, p.y - 13, 5, 3);
  }
}
export const airportPoint = (w: World, c: Settlement) => {
  const p = coordinates(w, c.tile);
  return { x: p.x + 8, y: p.y + 11 };
};
function person(
  ctx: CanvasRenderingContext2D,
  u: Citizen,
  x: number,
  y: number,
  color: string,
  era: number,
  clock: number,
  paused: boolean,
) {
  const moving = Math.hypot(u.x - u.previousX, u.y - u.previousY) > 0.02;
  const leg = moving && !paused ? Math.floor(clock * 9 + u.id) % 2 : 0;
  if (u.role === "merchant" && era >= 3) {
    ctx.fillStyle = "#37565355";
    ctx.fillRect(x - 3, y + 1, 7, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 2, 6, 3);
    ctx.fillStyle = "#e0e4cc";
    ctx.fillRect(x - 1, y - 3, 3, 2);
    ctx.fillStyle = "#334746";
    ctx.fillRect(x - 2, y + 1, 1.5, 1);
    ctx.fillRect(x + 2, y + 1, 1.5, 1);
    return;
  }
  ctx.fillStyle = "#23473750";
  ctx.fillRect(x - 1.8, y + 0.2, 4.4, 1.1);
  ctx.fillStyle = u.id % 3 ? "#ebcda3" : "#bc9475";
  ctx.fillRect(x - 1, y - 5.5, 2, 2);
  ctx.fillStyle =
    u.role === "ruler"
      ? "#9d5654"
      : u.role === "farmer"
        ? "#a48b55"
        : u.role === "miner"
          ? "#788e94"
          : u.role === "woodcutter"
            ? "#78895d"
            : color;
  ctx.fillRect(x - 1.3, y - 3.5, 2.6, 2.6);
  ctx.fillStyle = "#455e55";
  ctx.fillRect(x - 1, y - 1, 1, 1 + leg * 0.6);
  ctx.fillRect(x + 0.3, y - 1, 1, 1 + (1 - leg) * 0.6);
  if (u.role === "ruler") {
    ctx.fillStyle = "#f4d379";
    ctx.fillRect(x - 1.5, y - 6.3, 3, 1);
    ctx.fillRect(x - 1.5, y - 7, 1, 1);
    ctx.fillRect(x + 0.5, y - 7, 1, 1);
  } else if (u.role === "farmer") {
    ctx.fillStyle = "#d1b268";
    ctx.fillRect(x - 2, y - 5.7, 4, 1);
  } else if (u.role === "miner") {
    ctx.fillStyle = "#cfbd7e";
    ctx.fillRect(x - 1.5, y - 6, 3, 1);
    ctx.fillStyle = "#d8d9bd";
    ctx.fillRect(x + 2, y - 3, 1, 3);
    ctx.fillRect(x + 1, y - 4, 3, 1);
  } else if (u.role === "woodcutter") {
    ctx.fillStyle = "#806344";
    ctx.fillRect(x + 2, y - 3, 1, 3);
    ctx.fillStyle = "#b3c0b2";
    ctx.fillRect(x + 2, y - 4, 2, 2);
  } else if (u.role === "builder") {
    ctx.fillStyle = "#dbc179";
    ctx.fillRect(x - 1.5, y - 6, 3, 1);
    ctx.fillRect(x + 2, y - 3, 2, 1);
  }
}
export function drawActors(
  ctx: CanvasRenderingContext2D,
  w: World,
  alpha: number,
  clock: number,
  zoom: number,
  paused: boolean,
) {
  const s = w.life;
  if (!s) return;
  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  const transform = ctx.getTransform();
  const visible = (x: number, y: number) =>
    x > -transform.e / transform.a - 35 &&
    x < (ctx.canvas.width - transform.e) / transform.a + 35 &&
    y > -transform.f / transform.d - 35 &&
    y < (ctx.canvas.height - transform.f) / transform.d + 35;
  if (zoom > 0.8)
    for (const p of s.polities) {
      if (!(p.satellites || 0)) continue;
      const n = w.nations[p.nation - 1];
      if (!n?.alive) continue;
      const pt = coordinates(w, n.capital);
      ctx.fillStyle = "#d5e9dc";
      ctx.fillRect(pt.x + 14, pt.y - 23, 3, 3);
      ctx.fillStyle = "#719daa";
      ctx.fillRect(pt.x + 10, pt.y - 22, 4, 2);
      ctx.fillRect(pt.x + 17, pt.y - 22, 4, 2);
      ctx.fillStyle = "#e5d4a0";
      ctx.fillRect(pt.x + 15, pt.y - 25, 1, 2);
    }
  for (const u of s.citizens) {
    const n = w.nations[u.nation - 1];
    if (!n?.alive) continue;
    const x = lerp(u.previousX, u.x) * 8,
      y = lerp(u.previousY, u.y) * 8 + 2;
    if (!visible(x, y)) continue;
    if (zoom >= 3)
      pixelPerson(
        ctx,
        x,
        y,
        n.color,
        u.role,
        equipmentEra(n),
        !paused &&
          (Math.hypot(u.x - u.previousX, u.y - u.previousY) > 0.02 ||
            (u.work > 0 && !u.returning))
          ? Math.floor(clock * 9 + u.id) % 2
          : 0,
        u.work > 0 && !u.returning,
      );
    else person(ctx, u, x, y, n.color, equipmentEra(n), clock, paused);
  }
  for (const a of s.armies) {
    const n = w.nations[a.nation - 1];
    if (!n?.alive) continue;
    const x = lerp(a.previousX, a.x) * 8,
      y = lerp(a.previousY, a.y) * 8,
      era = equipmentEra(n);
    if (!visible(x, y)) continue;
    if (zoom >= 3) {
      for (let i = 0; i < Math.min(4, Math.ceil(a.strength / 15)); i++)
        pixelPerson(
          ctx,
          x + (i % 2) * 5 - 3,
          y + Math.floor(i / 2) * 4,
          n.color,
          "soldier",
          era,
          !paused &&
            (a.fighting ||
              Math.hypot(a.x - a.previousX, a.y - a.previousY) > 0.02)
            ? Math.floor(clock * 8 + i) % 2
            : 0,
          a.fighting,
        );
    }
    ctx.fillStyle = "#2b4f4855";
    ctx.fillRect(x - 5, y, 12, 3);
    if (era >= 3 && zoom < 3) {
      ctx.fillStyle = n.color;
      ctx.fillRect(x - 4, y - 4, 9, 4);
      ctx.fillStyle = "#435a55";
      ctx.fillRect(x - 5, y, 11, 2);
      ctx.fillStyle = "#b7c3b1";
      ctx.fillRect(x - 1, y - 6, 5, 2);
      ctx.fillRect(x + 3, y - 5, 5, 1);
    } else if (zoom < 3)
      for (let i = 0; i < Math.min(6, Math.ceil(a.strength / 10)); i++) {
        const xx = x + ((i % 3) - 1) * 3,
          yy = y + Math.floor(i / 3) * 3;
        ctx.fillStyle = "#c9d1bf";
        ctx.fillRect(xx - 1, yy - 5, 2, 2);
        ctx.fillStyle = n.color;
        ctx.fillRect(xx - 1, yy - 3, 2, 2);
        ctx.fillStyle = "#516c60";
        ctx.fillRect(xx - 1, yy - 1, 2, 1);
        ctx.fillStyle = "#e1dfba";
        ctx.fillRect(xx + 1.5, yy - 6, 0.6, 5);
      }
    ctx.fillStyle = "#e1d2a4";
    ctx.fillRect(x - 4, y - 11, 1, 7);
    ctx.fillStyle = n.color;
    ctx.fillRect(x - 3, y - 11, 5, 3);
    ctx.fillStyle = "#203f3b";
    ctx.fillRect(x - 5, y + 5, 12, 2);
    ctx.fillStyle = a.fighting ? "#efb278" : n.color;
    ctx.fillRect(x - 5, y + 5, Math.min(12, a.strength / 20), 2);
    if (a.fighting) {
      ctx.strokeStyle = "#ffe1a2";
      ctx.lineWidth = 0.7;
      const flash = paused ? 2 : 2 + (Math.floor(clock * 9) % 3);
      ctx.beginPath();
      ctx.moveTo(x + 5 - flash, y - 7);
      ctx.lineTo(x + 5 + flash, y - 3);
      ctx.moveTo(x + 5 + flash, y - 7);
      ctx.lineTo(x + 5 - flash, y - 3);
      ctx.stroke();
    }
  }
  const cityById = new Map(s.settlements.map((c) => [c.id, c]));
  for (const f of s.flights) {
    const a = cityById.get(f.from),
      b = cityById.get(f.to),
      n = w.nations[f.nation - 1];
    if (!a || !b || !n?.alive) continue;
    const start = airportPoint(w, a),
      end = airportPoint(w, b),
      t = lerp(f.previousProgress, f.progress),
      curve = Math.sin(t * Math.PI) * 10,
      x = start.x + (end.x - start.x) * t,
      y = start.y + (end.y - start.y) * t - curve;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(
      Math.atan2(
        end.y - start.y - Math.cos(t * Math.PI) * Math.PI * 10,
        end.x - start.x,
      ),
    );
    ctx.fillStyle = "#23454b35";
    ctx.fillRect(-4, 4, 9, 1.5);
    ctx.fillStyle = "#f4eed3";
    ctx.fillRect(-5, -1, 10, 2);
    ctx.fillRect(-1, -5, 2, 10);
    ctx.fillRect(-4, -3, 1, 6);
    ctx.fillStyle = n.color;
    ctx.fillRect(-5, -1, 2, 2);
    ctx.fillStyle = "#7098a5";
    ctx.fillRect(2, -0.5, 2, 1);
    ctx.restore();
    if (zoom > 1.6) {
      ctx.fillStyle = "#ecedd1bd";
      ctx.font = "3.5px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("항공 교역", x, y - 8);
    }
  }
  if (zoom > 2.4) {
    ctx.font = "3px system-ui";
    ctx.textAlign = "center";
    for (const c of s.settlements) {
      const n = w.nations[c.nation - 1];
      if (!n?.alive) continue;
      const p = coordinates(w, c.tile);
      if (!visible(p.x, p.y)) continue;
      ctx.fillStyle = "#234b40bf";
      ctx.fillRect(p.x - 9, p.y + 14, 18, 6);
      ctx.fillStyle = "#e6e2bf";
      ctx.fillText(Math.round(c.population) + "명", p.x, p.y + 18);
    }
  }
}
