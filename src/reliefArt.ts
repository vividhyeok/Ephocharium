import type { World } from "./engine";
import { adjacent } from "./geography";
/** Connected mountain masses with shared foothills, alternating ridges and lit rock faces. */
export function drawRelief(ctx: CanvasRenderingContext2D, w: World) {
  const seen = new Uint8Array(w.tiles.length);
  for (let origin = 0; origin < w.tiles.length; origin++) {
    if (seen[origin] || w.tiles[origin].t !== 4) continue;
    const cells = [origin];
    seen[origin] = 1;
    for (let k = 0; k < cells.length; k++)
      for (const j of adjacent(w, cells[k]))
        if (!seen[j] && w.tiles[j].t === 4) {
          seen[j] = 1;
          cells.push(j);
        }
    const columns = new Map<number, number[]>();
    for (const i of cells) {
      const group = Math.floor((i % w.width) / 3);
      const list = columns.get(group) || [];
      list.push(i);
      columns.set(group, list);
    }
    const peaks = [...columns.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([col, list]) => {
        const mid =
          list.reduce((s, i) => s + Math.floor(i / w.width), 0) / list.length;
        const elevation = Math.max(
          ...list.map((i) => w.tiles[i].elevation || 0.8),
        );
        return {
          x: Math.min(w.width * 8 - 8, col * 24 + 12),
          y: mid * 8 + 6,
          h: 12 + Math.min(15, elevation * 12) + (col % 2) * 4,
        };
      });
    if (!peaks.length) continue;
    const shape = (points: number[][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };
    for (let k = 0; k < peaks.length; k++) {
      const p = peaks[k],
        next = peaks[k + 1];
      if (next)
        shape(
          [
            [p.x - 13, p.y + 9],
            [p.x, p.y - p.h],
            [next.x, next.y - next.h],
            [next.x + 14, next.y + 10],
          ],
          "#7d8f83",
        );
      shape(
        [
          [p.x - 17, p.y + 10],
          [p.x - 7, p.y - 6],
          [p.x, p.y - p.h],
          [p.x + 9, p.y - 5],
          [p.x + 19, p.y + 10],
        ],
        "#76877c",
      );
      shape(
        [
          [p.x - 17, p.y + 10],
          [p.x - 7, p.y - 6],
          [p.x, p.y - p.h],
          [p.x - 2, p.y - 6],
          [p.x + 4, p.y + 10],
        ],
        "#b2baa3",
      );
      shape(
        [
          [p.x - 7, p.y - 6],
          [p.x, p.y - p.h],
          [p.x - 2, p.y - 6],
          [p.x - 8, p.y + 4],
        ],
        "#d2d2b9",
      );
      shape(
        [
          [p.x + 2, p.y - 9],
          [p.x + 9, p.y - 5],
          [p.x + 19, p.y + 10],
          [p.x + 10, p.y + 6],
        ],
        "#657c73",
      );
      if (p.h > 26)
        shape(
          [
            [p.x - 4, p.y - p.h + 9],
            [p.x, p.y - p.h],
            [p.x + 5, p.y - p.h + 10],
            [p.x + 1, p.y - p.h + 7],
            [p.x - 1, p.y - p.h + 10],
          ],
          "#e5e6d6",
        );
    }
  }
}
