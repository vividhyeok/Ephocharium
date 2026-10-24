import { useEffect, useRef } from "react";
import type { World } from "./engine";
import Icon from "./Icons";
export default function Minimap({
  world,
  onFocus,
}: {
  world: World;
  onFocus: (tile: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const colors = [
      "#397c83",
      "#cbbd89",
      "#819c65",
      "#557d56",
      "#8b9685",
      "#c8d4bc",
    ];
    world.tiles.forEach((t, i) => {
      ctx.fillStyle = t.owner
        ? world.nations[t.owner - 1]?.color || colors[t.t]
        : colors[t.t];
      ctx.fillRect(i % world.width, Math.floor(i / world.width), 1, 1);
    });
  }, [world]);
  return (
    <div className="minimap">
      <div className="minimap-title">
        <Icon name="compass" size={13} />
        <span>세계 전도</span>
        <small>
          {world.width} × {world.height}
        </small>
      </div>
      <canvas
        ref={ref}
        width={world.width}
        height={world.height}
        role="button"
        tabIndex={0}
        aria-label="미니맵으로 세계 중앙 이동"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFocus(Math.floor(world.tiles.length / 2));
          }
        }}
        onClick={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          onFocus(
            Math.min(
              world.tiles.length - 1,
              Math.floor(((e.clientY - b.top) / b.height) * world.height) *
                world.width +
                Math.floor(((e.clientX - b.left) / b.width) * world.width),
            ),
          );
        }}
      />
      <div className="minimap-note">
        <span className="live-dot" />
        실시간 영토 변화
      </div>
    </div>
  );
}
