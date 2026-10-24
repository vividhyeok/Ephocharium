import { politicalColors } from "./politicalColors";
import { drawRelief } from "./reliefArt";
import type { World } from "./engine";
/** Quiet atlas ground. Relief is a continuous surface, never a field of building sprites. */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  w: World,
  political: boolean,
  detail: number,
) {
  const colors = [
    "#467d88",
    "#d3c69d",
    "#a9b392",
    "#a4b08f",
    "#9ba595",
    "#dde3d8",
  ];
  const bloc = politicalColors(w);
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i],
      x = (i % w.width) * 8,
      y = Math.floor(i / w.width) * 8;
    ctx.fillStyle = colors[t.t];
    ctx.fillRect(x, y, 8, 8);
    if (t.t === 4 || ((t.elevation || 0) > 0.65 && t.t !== 0)) {
      const west = w.tiles[i - 1]?.elevation || 0,
        east = w.tiles[i + 1]?.elevation || 0;
      const slope = Math.max(-0.18, Math.min(0.18, (west - east) * 0.55));
      ctx.fillStyle =
        slope > 0 ? `rgba(40,64,57,${slope})` : `rgba(242,239,215,${-slope})`;
      ctx.fillRect(x, y, 8, 8);
    }
    if (t.t === 3 && (t.wood || 0) > 4 && detail > 0 && i % 3 === 0) {
      ctx.fillStyle = "#547a6460";
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 5, 5.5, 3, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#6e9073";
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 2, 3.8, 3.4, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#8ba181";
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 1, 2.8, 2, 0, 0, 7);
      ctx.fill();
    }
    if (t.damage > 0.05) {
      ctx.fillStyle = `rgba(96,65,47,${t.damage * 0.38})`;
      ctx.fillRect(x, y, 8, 8);
    }
    if (political && t.owner) {
      const n = w.nations[t.owner - 1];
      if (!n) continue;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = bloc.get(n.id)!;
      ctx.fillRect(x, y, 8, 8);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      if (i % w.width === 0 || w.tiles[i - 1]?.owner !== t.owner) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 8);
      }
      if (w.tiles[i - w.width]?.owner !== t.owner) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y);
      }
      if (i % w.width === w.width - 1 || w.tiles[i + 1]?.owner !== t.owner) {
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 8, y + 8);
      }
      if (w.tiles[i + w.width]?.owner !== t.owner) {
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 8, y + 8);
      }
      ctx.strokeStyle = "#344e4566";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = bloc.get(n.id)!;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  drawRelief(ctx, w);
}
