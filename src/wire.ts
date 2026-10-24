import type { World, Tile } from "./engine";
export const DYNAMIC_TILE_FIELDS = [
  "t",
  "owner",
  "fertility",
  "ore",
  "damage",
  "wood",
  "mineral",
  "road",
  "rail",
  "bridge",
  "tunnel",
  "deposits",
  "mine",
] as const;
export type TilePatch = { index: number; values: unknown[] };
export const tileStamp = (t: Tile) =>
  [
    t.t,
    t.owner,
    t.fertility,
    t.ore,
    t.damage,
    t.wood,
    t.mineral,
    t.road,
    t.rail,
    +!!t.bridge,
    +!!t.tunnel,
    t.mine,
    ...Object.values(t.deposits || {}),
  ].join("|");
export function patchWorld(
  previous: World,
  meta: Omit<World, "tiles">,
  patches: TilePatch[],
): World {
  const tiles = [...previous.tiles];
  for (const p of patches) {
    const t = { ...tiles[p.index] };
    DYNAMIC_TILE_FIELDS.forEach((key, k) => {
      (t as any)[key] = p.values[k];
    });
    tiles[p.index] = t;
  }
  return { ...meta, tiles };
}
