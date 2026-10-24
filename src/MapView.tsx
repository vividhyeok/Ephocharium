import { useEffect, useRef } from "react";
import type { World } from "./engine";
const PALETTE = [
  "#246477",
  "#d5c391",
  "#829d61",
  "#53794d",
  "#8a9290",
  "#c6d6cf",
];
interface Props {
  world: World;
  tool: string;
  radius: number;
  political: boolean;
  onUse: (tile: number) => void;
  onSelect: (id: number) => void;
  focus: number | null;
}
export default function MapView(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const camera = useRef({ x: 0, y: 0, zoom: 1, ready: false });
  useEffect(() => {
    const el = canvas.current!;
    let ctx = el.getContext("2d")!;
    const raster = document.createElement("canvas");
    let cachedWorld: World | undefined;
    let cachedPolitical: boolean | undefined;
    let frame = 0;
    let down = false;
    let drag = false;
    let last = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    let lastTile = -1;
    let hover = -1;
    let dims = "";
    const resize = () => {
      const r = el.getBoundingClientRect();
      el.width = Math.round(r.width * devicePixelRatio);
      el.height = Math.round(r.height * devicePixelRatio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const locate = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect(),
        c = camera.current,
        w = latest.current.world;
      const x = Math.floor((e.clientX - r.left - c.x) / c.zoom / 8),
        y = Math.floor((e.clientY - r.top - c.y) / c.zoom / 8);
      return x >= 0 && x < w.width && y >= 0 && y < w.height
        ? y * w.width + x
        : -1;
    };
    const use = (i: number) => {
      if (i < 0) return;
      const p = latest.current;
      if (p.tool === "inspect") p.onSelect(p.world.tiles[i].owner);
      else if (i !== lastTile) {
        p.onUse(i);
        lastTile = i;
      }
    };
    const pointerDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      down = true;
      drag =
        e.button === 1 || e.button === 2 || latest.current.tool === "inspect";
      origin = last = { x: e.clientX, y: e.clientY };
      lastTile = -1;
      if (!drag) use(locate(e));
    };
    const move = (e: PointerEvent) => {
      hover = locate(e);
      if (!down) return;
      if (drag) {
        camera.current.x += e.clientX - last.x;
        camera.current.y += e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
      } else use(hover);
    };
    const up = (e: PointerEvent) => {
      if (drag && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 5) {
        const i = locate(e);
        if (i >= 0)
          latest.current.onSelect(latest.current.world.tiles[i].owner);
      }
      down = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(),
        c = camera.current,
        z = c.zoom;
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      c.zoom = Math.max(0.4, Math.min(12, z * Math.exp(-e.deltaY * 0.001)));
      c.x = x - ((x - c.x) * c.zoom) / z;
      c.y = y - ((y - c.y) * c.zoom) / z;
    };
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.oncontextmenu = (e) => e.preventDefault();
    const draw = () => {
      const { world: w, political, tool, radius } = latest.current;
      const c = camera.current;
      const width = el.width / devicePixelRatio,
        height = el.height / devicePixelRatio;
      const key = w.seed + ":" + w.width + ":" + w.height;
      if (!c.ready || key !== dims) {
        c.zoom = Math.min(
          (width - 80) / (w.width * 8),
          (height - 80) / (w.height * 8),
        );
        c.x = (width - w.width * 8 * c.zoom) / 2;
        c.y = (height - w.height * 8 * c.zoom) / 2;
        c.ready = true;
        dims = key;
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.fillStyle = "#173f4b";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.zoom, c.zoom);
      ctx.imageSmoothingEnabled = false;
      const time = performance.now() / 1000;
      if (cachedWorld !== w || cachedPolitical !== political) {
        raster.width = w.width * 8;
        raster.height = w.height * 8;
        const display = ctx;
        ctx = raster.getContext("2d")!;
        w.tiles.forEach((cell, i) => {
          const x = (i % w.width) * 8,
            y = Math.floor(i / w.width) * 8;
          const noise = ((i * 7919 + w.seed * 17) >>> 0) % 97;
          ctx.fillStyle = PALETTE[cell.t];
          ctx.fillRect(x, y, 8, 8);
          ctx.fillStyle =
            cell.t === 0
              ? noise < 45
                ? "#286c7e"
                : "#2c7080"
              : cell.t === 2
                ? noise < 50
                  ? "#8da76a"
                  : "#78955d"
                : cell.t === 3
                  ? "#608653"
                  : "#ffffff12";
          ctx.fillRect(x + (noise % 5), y + (noise % 4), 3, 2);
          if (
            cell.t === 0 &&
            [i - 1, i + 1, i - w.width, i + w.width].some(
              (j) => w.tiles[j] && w.tiles[j].t !== 0,
            )
          ) {
            ctx.fillStyle = "#62a3a0";
            ctx.fillRect(x, y, 8, 2);
          }
          if (cell.t === 3) {
            ctx.fillStyle = "#355a40";
            ctx.fillRect(x + 3, y + 3, 2, 5);
            ctx.fillStyle = "#456c46";
            ctx.fillRect(x + 1, y + 2, 6, 3);
            ctx.fillRect(x + 2, y, 4, 3);
            ctx.fillStyle = "#78945a";
            ctx.fillRect(x + 2, y + 1, 2, 1);
          }
          if (cell.t === 4) {
            ctx.fillStyle = "#626f70";
            ctx.beginPath();
            ctx.moveTo(x, y + 8);
            ctx.lineTo(x + 4, y - 3);
            ctx.lineTo(x + 9, y + 8);
            ctx.fill();
            ctx.fillStyle = "#c5cebd";
            ctx.fillRect(x + 3, y, 3, 2);
          }
          if (cell.damage > 0) {
            ctx.fillStyle = "rgba(77,44,30," + cell.damage * 0.65 + ")";
            ctx.fillRect(x, y, 8, 8);
          }
          if (!cell.owner) return;
          const n = w.nations[cell.owner - 1];
          if (!n) return;
          if (political) {
            ctx.globalAlpha = 0.19;
            ctx.fillStyle = n.color;
            ctx.fillRect(x, y, 8, 8);
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = n.color;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            if (i % w.width === 0 || w.tiles[i - 1]?.owner !== cell.owner) {
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + 8);
            }
            if (
              i % w.width === w.width - 1 ||
              w.tiles[i + 1]?.owner !== cell.owner
            ) {
              ctx.moveTo(x + 8, y);
              ctx.lineTo(x + 8, y + 8);
            }
            if (w.tiles[i - w.width]?.owner !== cell.owner) {
              ctx.moveTo(x, y);
              ctx.lineTo(x + 8, y);
            }
            if (w.tiles[i + w.width]?.owner !== cell.owner) {
              ctx.moveTo(x, y + 8);
              ctx.lineTo(x + 8, y + 8);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (i % 11 === 0 && cell.t === 2) {
            ctx.fillStyle = "#c1ac68";
            ctx.fillRect(x + 1, y + 2, 6, 5);
            ctx.fillStyle = "#8f9850";
            for (let a = 0; a < 3; a++)
              ctx.fillRect(x + 1 + a * 2, y + 2, 1, 5);
          }
          if (i % 13 === 0 || i === n.capital) {
            const capital = i === n.capital;
            ctx.fillStyle = "#34443d";
            ctx.fillRect(x + 2, y + 4, capital ? 8 : 5, 5);
            ctx.fillStyle = "#eed5a1";
            ctx.fillRect(x + 1, y + 2, capital ? 8 : 5, 5);
            ctx.fillStyle = n.color;
            ctx.fillRect(x, y, capital ? 10 : 7, 3);
            ctx.fillStyle = "#4b4e43";
            ctx.fillRect(x + 3, y + 4, 2, 3);
            if (capital) {
              ctx.fillStyle = "#f3df9e";
              ctx.fillRect(x + 4, y - 7, 1, 7);
              ctx.fillStyle = n.color;
              ctx.fillRect(x + 5, y - 7, 5, 3);
            }
          }
        });
        ctx = display;
        cachedWorld = w;
        cachedPolitical = political;
      }
      ctx.drawImage(raster, 0, 0);
      if (c.zoom > 1)
        for (let i = 0; i < w.tiles.length; i += 7) {
          const cell = w.tiles[i];
          if (!cell.owner) continue;
          const n = w.nations[cell.owner - 1];
          if (!n) continue;
          const x = (i % w.width) * 8,
            y = Math.floor(i / w.width) * 8,
            walk = Math.sin(time * 1.5 + i) * 2;
          ctx.fillStyle = "#ead4a6";
          ctx.fillRect(x + 4 + walk, y + 3, 1.5, 1.5);
          ctx.fillStyle = n.color;
          ctx.fillRect(x + 4 + walk, y + 4.5, 1.5, 2);
        }
      for (const s of w.settlers) {
        ctx.fillStyle = "#f0d6aa";
        ctx.fillRect(
          (s.tile % w.width) * 8 + 3,
          Math.floor(s.tile / w.width) * 8 + 2,
          3,
          4,
        );
      }
      for (const e of w.effects) {
        const x = (e.tile % w.width) * 8 + 4,
          y = Math.floor(e.tile / w.width) * 8 + 4;
        ctx.strokeStyle = e.kind === "flood" ? "#9ce5f4" : "#ffb861";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? "#f5c15c" : "#e37743";
          ctx.fillRect(
            x + Math.sin(i * 5 + time) * 8,
            y - Math.abs(Math.sin(time * 2 + i)) * 15,
            2,
            3,
          );
        }
      }
      if (hover >= 0 && tool !== "inspect") {
        ctx.strokeStyle = "#fff1bf";
        ctx.lineWidth = 1 / c.zoom;
        ctx.beginPath();
        ctx.arc(
          (hover % w.width) * 8 + 4,
          Math.floor(hover / w.width) * 8 + 4,
          (radius + 0.5) * 8,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
      const labels: { x: number; y: number; width: number }[] = [];
      for (const n of w.nations
        .filter((n) => n.alive)
        .sort((a, b) => b.population - a.population)) {
        const x = c.x + ((n.capital % w.width) * 8 + 4) * c.zoom,
          y = c.y + Math.floor(n.capital / w.width) * 8 * c.zoom - 15;
        ctx.font = "600 11px system-ui";
        ctx.textAlign = "center";
        const label = n.name.replace(" 왕국", "");
        const tw = ctx.measureText(label).width;
        if (x + tw < 0 || x - tw > width || y < 0 || y > height) continue;
        if (
          labels.some(
            (l) =>
              Math.abs(l.y - y) < 25 &&
              Math.abs(l.x - x) < (l.width + tw) / 2 + 20,
          )
        )
          continue;
        labels.push({ x, y, width: tw });
        ctx.fillStyle = "#152c2be6";
        ctx.fillRect(x - tw / 2 - 9, y - 12, tw + 18, 22);
        ctx.fillStyle = n.color;
        ctx.fillText(label, x, y + 3);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("pointerdown", pointerDown);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  useEffect(() => {
    if (props.focus === null) return;
    const el = canvas.current!,
      c = camera.current,
      w = props.world;
    c.x = el.clientWidth / 2 - ((props.focus % w.width) * 8 + 4) * c.zoom;
    c.y =
      el.clientHeight / 2 -
      (Math.floor(props.focus / w.width) * 8 + 4) * c.zoom;
  }, [props.focus]);
  return (
    <canvas ref={canvas} className="world-canvas" aria-label="문명 세계 지도" />
  );
}
