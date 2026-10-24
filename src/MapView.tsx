import { drawTerrain } from "./terrainArt";
import { drawHydrology, drawTransport } from "./livingScene";
import { useEffect, useRef } from "react";
import type { World } from "./engine";
import { drawInfrastructure, drawActors } from "./scene";
import { ERAS, eraOf } from "./civilization";
const PALETTE = [
  "#478b95",
  "#e3d39e",
  "#a8bb78",
  "#91ab69",
  "#a5ad99",
  "#d8e2ce",
];
interface Props {
  world: World;
  worldEpoch: number;
  pair?: [number, number];
  tool: string;
  radius: number;
  political: boolean;
  labels: boolean;
  cities: boolean;
  diplomacy: boolean;
  selected: number;
  onUse: (tile: number) => void;
  onSelect: (id: number) => void;
  focus: { tile: number; request: number } | null;
  command: { action: string; id: number };
  paused: boolean;
  speed: number;
  onStroke: (begin: boolean) => void;
  onHover: (tile: number) => void;
}
export default function MapView(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const camera = useRef({ x: 0, y: 0, zoom: 1, ready: false });
  useEffect(() => {
    const el = canvas.current!;
    const dpr = Math.min(
      window.devicePixelRatio,
      matchMedia("(pointer:coarse)").matches ? 1.5 : 2,
    );
    let ctx = el.getContext("2d")!;
    const raster = document.createElement("canvas");
    let cachedWorld: World | undefined;
    let cachedPolitical: boolean | undefined;
    let cachedRevision: number | undefined;
    let cachedDetail = -1;
    let cachedEpoch: number | undefined;
    let frame = 0;
    const paintInterval = matchMedia("(pointer:coarse)").matches ? 1000 / 24 : 1000 / 30;
    let lastPaint = -Infinity;
    let down = false;
    let drag = false;
    let singleClick = false;
    let last = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    let lastTile = -1;
    let hover = -1;
    let dims = "";
    let snapshot: World | undefined;
    let snapshotTime = performance.now();
    const resize = () => {
      const r = el.getBoundingClientRect();
      el.width = Math.round(r.width * dpr);
      el.height = Math.round(r.height * dpr);
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
    const leave = () => {
      hover = -1;
      latest.current.onHover(-1);
    };
    el.addEventListener("pointerleave", leave);
    const touches = new Map<number, { x: number; y: number }>();
    let pinched = false;
    const touchDistance = () => {
      const p = [...touches.values()];
      return p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    };
    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        el.setPointerCapture(e.pointerId);
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 1) {
          down = true;
          drag = true;
          pinched = false;
          origin = last = { x: e.clientX, y: e.clientY };
        } else pinched = true;
        return;
      }
      el.setPointerCapture(e.pointerId);
      down = true;
      singleClick = ["war", "alliance", "peace"].includes(latest.current.tool);
      drag =
        e.button === 1 || e.button === 2 || latest.current.tool === "inspect";
      origin = last = { x: e.clientX, y: e.clientY };
      lastTile = -1;
      if (!drag) {
        latest.current.onStroke(true);
        use(locate(e));
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" && touches.has(e.pointerId)) {
        const before = touchDistance();
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size > 1) {
          const after = touchDistance(),
            p = [...touches.values()],
            r = el.getBoundingClientRect(),
            x = (p[0].x + p[1].x) / 2 - r.left,
            y = (p[0].y + p[1].y) / 2 - r.top,
            c = camera.current,
            z = c.zoom;
          c.zoom = Math.max(
            0.15,
            Math.min(18, (z * after) / Math.max(1, before)),
          );
          c.x = x - ((x - c.x) * c.zoom) / z;
          c.y = y - ((y - c.y) * c.zoom) / z;
          return;
        }
        if (down) {
          camera.current.x += e.clientX - last.x;
          camera.current.y += e.clientY - last.y;
          last = { x: e.clientX, y: e.clientY };
        }
        return;
      }
      hover = locate(e);
      latest.current.onHover(hover);
      if (!down) return;
      if (drag) {
        camera.current.x += e.clientX - last.x;
        camera.current.y += e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
      } else if (!singleClick) use(hover);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        touches.delete(e.pointerId);
        if (
          !pinched &&
          e.type !== "pointercancel" &&
          Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 7
        ) {
          const i = locate(e);
          if (i >= 0) {
            const p = latest.current;
            if (p.tool === "inspect") p.onSelect(p.world.tiles[i].owner);
            else {
              p.onStroke(true);
              p.onUse(i);
              p.onStroke(false);
            }
            p.onHover(i);
          }
        }
        down = touches.size > 0;
        if (down) {
          const p = [...touches.values()][0];
          last = { x: p.x, y: p.y };
        }
        if (!touches.size) pinched = false;
        return;
      }
      if (drag && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 5) {
        const i = locate(e);
        if (i >= 0)
          latest.current.onSelect(latest.current.world.tiles[i].owner);
      }
      if (down && !drag) latest.current.onStroke(false);
      down = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(),
        c = camera.current,
        z = c.zoom;
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      c.zoom = Math.max(0.15, Math.min(18, z * Math.exp(-e.deltaY * 0.001)));
      c.x = x - ((x - c.x) * c.zoom) / z;
      c.y = y - ((y - c.y) * c.zoom) / z;
    };
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.oncontextmenu = (e) => e.preventDefault();
    const draw = (timestamp: number = performance.now()) => {
      frame = requestAnimationFrame(draw);
      if (timestamp - lastPaint < paintInterval) return;
      lastPaint = timestamp;
      const { world: w, political, tool, radius } = latest.current;
      const c = camera.current;
      el.dataset.zoom = c.zoom.toFixed(3);
      const width = el.width / dpr,
        height = el.height / dpr;
      const key =
        w.seed +
        ":" +
        w.width +
        ":" +
        w.height +
        ":" +
        latest.current.worldEpoch;
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#397b87";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.zoom, c.zoom);
      ctx.imageSmoothingEnabled = false;
      const time = performance.now() / 1000;
      if (snapshot !== w) {
        snapshot = w;
        snapshotTime = performance.now();
      }
      if (
        cachedEpoch !== latest.current.worldEpoch ||
        cachedWorld?.seed !== w.seed ||
        cachedWorld?.width !== w.width ||
        cachedRevision !== w.renderRevision ||
        (w.renderRevision === undefined && cachedWorld !== w) ||
        cachedPolitical !== political ||
        cachedDetail !== (c.zoom < 0.85 ? 0 : c.zoom < 2 ? 1 : 2)
      ) {
        raster.width = w.width * 8;
        raster.height = w.height * 8;
        const display = ctx;
        ctx = raster.getContext("2d")!;
        drawTerrain(ctx, w, political, c.zoom < 0.85 ? 0 : 1);
        drawHydrology(ctx, w);
        drawInfrastructure(ctx, w, c.zoom < 0.85 ? 0 : c.zoom < 2 ? 1 : 2);
        cachedDetail = c.zoom < 0.85 ? 0 : c.zoom < 2 ? 1 : 2;
        ctx = display;
        cachedEpoch = latest.current.worldEpoch;
        cachedRevision = w.renderRevision;
        cachedWorld = w;
        cachedPolitical = political;
      }
      ctx.drawImage(raster, 0, 0);
      drawActors(
        ctx,
        w,
        latest.current.paused
          ? 1
          : Math.min(
              1,
              (performance.now() - snapshotTime) /
                (4000 / latest.current.speed),
            ),
        time,
        c.zoom,
        latest.current.paused,
      );
      drawTransport(
        ctx,
        w,
        latest.current.paused
          ? 1
          : Math.min(
              1,
              (performance.now() - snapshotTime) /
                (4000 / latest.current.speed),
            ),
        c.zoom,
      );
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
        ctx.fillStyle = "#ffe5a040";
        for (let dy = -radius; dy <= radius; dy++)
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = (hover % w.width) + dx,
              yy = Math.floor(hover / w.width) + dy;
            if (
              dx * dx + dy * dy <= radius * radius &&
              xx >= 0 &&
              xx < w.width &&
              yy >= 0 &&
              yy < w.height
            )
              ctx.fillRect(xx * 8, yy * 8, 8, 8);
          }
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
      const related = latest.current.selected || w.tiles[hover]?.owner;
      if (latest.current.diplomacy && related) {
        for (const r of w.relations.filter(
          (r) => (r.allied || r.war) && (r.a === related || r.b === related),
        )) {
          const a = w.nations[r.a - 1],
            b = w.nations[r.b - 1];
          if (!a?.alive || !b?.alive) continue;
          const ax = c.x + ((a.capital % w.width) * 8 + 4) * c.zoom,
            ay = c.y + (Math.floor(a.capital / w.width) * 8 + 4) * c.zoom,
            bx = c.x + ((b.capital % w.width) * 8 + 4) * c.zoom,
            by = c.y + (Math.floor(b.capital / w.width) * 8 + 4) * c.zoom;
          ctx.strokeStyle = r.war ? "#f18c72" : "#80dfce";
          ctx.lineWidth = 2;
          ctx.setLineDash(r.war ? [6, 5] : []);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 36, bx, by);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = ctx.strokeStyle;
          for (const [x, y] of [
            [ax, ay],
            [bx, by],
          ]) {
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      if (latest.current.labels)
        for (const n of w.nations
          .filter((n) => n.alive)
          .sort((a, b) => b.population - a.population)) {
          const x = c.x + ((n.capital % w.width) * 8 + 4) * c.zoom,
            y = c.y + Math.floor(n.capital / w.width) * 8 * c.zoom - 15;
          ctx.font = "600 11px system-ui";
          ctx.textAlign = "center";
          const label =
            (latest.current.pair?.[0] === n.id
              ? "① "
              : latest.current.pair?.[1] === n.id
                ? "② "
                : "") +
            (n.culture?.baseName ||
              n.name.replace(/ 왕국| 연방| 상업 연맹| 성도국/g, "")) +
            (" · Lv." + (eraOf(n) + 1)) +
            "";
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
          ctx.fillStyle = "#183b3be8";
          ctx.beginPath();
          ctx.roundRect(x - tw / 2 - 12, y - 13, tw + 24, 24, 5);
          ctx.fill();
          ctx.strokeStyle = n.color + "88";
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.fillStyle = "#eee7d1";
          ctx.fillText(label, x, y + 3);
        }
      if (latest.current.cities && c.zoom >= 3.5)
        for (const city of w.life?.settlements || []) {
          if (city.population < 1 || (related && city.nation !== related))
            continue;
          const x = c.x + ((city.tile % w.width) * 8 + 4) * c.zoom,
            y = c.y + (Math.floor(city.tile / w.width) * 8 + 8) * c.zoom + 16;
          ctx.font = "500 11px system-ui";
          ctx.textAlign = "center";
          const label = city.name.replace(/.* (\d+)마을$/, "$1번 도시"),
            tw = ctx.measureText(label).width;
          if (
            x + tw < 0 ||
            x - tw > width ||
            y < 0 ||
            y > height ||
            labels.some(
              (l) =>
                Math.abs(l.y - y) < 22 &&
                Math.abs(l.x - x) < (l.width + tw) / 2 + 12,
            )
          )
            continue;
          labels.push({ x, y, width: tw });
          ctx.fillStyle = "#f2ecd9eb";
          ctx.beginPath();
          ctx.roundRect(x - tw / 2 - 7, y - 11, tw + 14, 21, 4);
          ctx.fill();
          ctx.fillStyle = "#233e3b";
          ctx.fillText(label, x, y + 3);
        }
      if (hover >= 0 && tool === "inspect") {
        const city = (w.life?.settlements || []).find(
          (s) =>
            Math.hypot(
              (s.tile % w.width) - (hover % w.width),
              Math.floor(s.tile / w.width) - Math.floor(hover / w.width),
            ) < 2.4,
        );
        const nation = w.nations[(w.tiles[hover]?.owner || 0) - 1];
        if (city || nation) {
          const owner = city ? w.nations[city.nation - 1] : nation;
          const allies = w.relations.filter(
            (r) => r.allied && (r.a === owner.id || r.b === owner.id),
          ).length;
          const enemies = w.relations.filter(
            (r) => r.war && (r.a === owner.id || r.b === owner.id),
          ).length;
          const lines = [
            city ? city.name : owner.name,
            city
              ? Math.round(city.population).toLocaleString() +
                "명 · " +
                owner.name
              : "Lv." + (eraOf(owner) + 1) + " · " + ERAS[eraOf(owner)].name,
            "동맹 " + allies + " · 전쟁 " + enemies,
          ];
          ctx.font = "12px system-ui";
          const tw =
            Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24;
          const x = Math.max(
              8,
              Math.min(
                width - tw - 8,
                c.x + ((hover % w.width) * 8 + 4) * c.zoom + 18,
              ),
            ),
            y = Math.max(
              8,
              Math.min(
                height - 80,
                c.y + Math.floor(hover / w.width) * 8 * c.zoom - 80,
              ),
            );
          ctx.fillStyle = "#132f32f5";
          ctx.beginPath();
          ctx.roundRect(x, y, tw, 74, 8);
          ctx.fill();
          ctx.strokeStyle = "#b9d9c955";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.textAlign = "left";
          lines.forEach((line, i) => {
            ctx.fillStyle = i === 0 ? "#f2e9cb" : "#b6d2c8";
            ctx.fillText(line, x + 12, y + 21 + i * 21);
          });
        }
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("pointerleave", leave);
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
    c.x = el.clientWidth / 2 - ((props.focus.tile % w.width) * 8 + 4) * c.zoom;
    c.y =
      el.clientHeight / 2 -
      (Math.floor(props.focus.tile / w.width) * 8 + 4) * c.zoom;
  }, [props.focus]);
  useEffect(() => {
    const el = canvas.current!,
      c = camera.current,
      w = latest.current.world;
    if (!c.ready) return;
    if (props.command.action === "fit") {
      c.zoom = Math.min(
        (el.clientWidth - 80) / (w.width * 8),
        (el.clientHeight - 80) / (w.height * 8),
      );
      c.x = (el.clientWidth - w.width * 8 * c.zoom) / 2;
      c.y = (el.clientHeight - w.height * 8 * c.zoom) / 2;
    } else {
      const z = c.zoom;
      c.zoom = Math.max(
        0.4,
        Math.min(
          18,
          props.command.action === "detail"
            ? Math.max(4, z)
            : z * (props.command.action === "in" ? 1.3 : 1 / 1.3),
        ),
      );
      c.x = el.clientWidth / 2 - ((el.clientWidth / 2 - c.x) * c.zoom) / z;
      c.y = el.clientHeight / 2 - ((el.clientHeight / 2 - c.y) * c.zoom) / z;
    }
  }, [props.command.id]);
  return (
    <canvas ref={canvas} className="world-canvas" aria-label="문명 세계 지도" />
  );
}
