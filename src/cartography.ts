import type { World, Tile } from "./engine";
import { nationName, nationColor } from "./identity";
export function coldPatch(
  seed: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const nx = x / width,
    ny = y / height;
  const ridge =
    Math.sin(nx * 19 + seed * 0.0001) * 0.035 +
    Math.cos(nx * 41 + ny * 17) * 0.018;
  const cloud =
    (Math.sin(x * 0.23 + Math.cos(y * 0.19) + seed * 0.001) +
      Math.cos(y * 0.37 - x * 0.11)) *
    0.5;
  return ny < 0.095 + ridge && cloud > 0.12;
}
/** One-time, deterministic migration. Add sea instead of deleting inhabited edge tiles. */
export function upgradeWorld(w: World) {
  if (w.identityRevision !== 2) {
    const renames = new Map<string, string>();
    for (const n of w.nations) {
      if (/ \d+세 왕국$/.test(n.name)) {
        const previous = n.name;
        n.name = nationName(n.id);
        renames.set(previous, n.name);
        n.originalName = previous;
      }
      if (n.id > 8) n.color = nationColor(n.id);
      const birth = w.history.find(
        (e) =>
          e.nations.length === 1 &&
          e.nations[0] === n.id &&
          e.text.endsWith(" 건국"),
      );
      if (n.foundedYear === undefined && birth) n.foundedYear = birth.year;
      const origin = w.history.find(
        (e) =>
          e.nations[1] === n.id && /행정 위기|독립 · 신의 개입/.test(e.text),
      );
      if (n.parentId === undefined && origin) n.parentId = origin.nations[0];
    }
    for (const e of w.history)
      for (const [oldName, newName] of renames)
        e.text = e.text.replaceAll(oldName, newName);
    if (w.life)
      for (const city of w.life.settlements) {
        const n = w.nations[city.nation - 1];
        if (n) {
          for (const [oldName, newName] of renames)
            city.name = city.name.replaceAll(
              oldName.replace(" 왕국", ""),
              newName.replace(" 왕국", ""),
            );
        }
      }
    w.identityRevision = 2;
  }
  if (w.cartographyRevision === 2) return w;
  const oldWidth = w.width,
    oldHeight = w.height;
  for (let i = 0; i < w.tiles.length; i++) {
    const t = w.tiles[i];
    if (
      t.t === 5 &&
      !coldPatch(
        w.seed,
        i % oldWidth,
        Math.floor(i / oldWidth),
        oldWidth,
        oldHeight,
      )
    ) {
      t.t = Math.sin(i * 0.71 + w.seed) > 0.1 ? 3 : 2;
      t.fertility = t.t === 3 ? 0.55 : 0.65;
      t.wood = t.t === 3 ? 70 : 0;
    }
  }
  const margin = Math.max(4, Math.ceil(oldWidth * 0.045)),
    width = oldWidth + margin * 2,
    height = oldHeight + margin * 2;
  const tileIndex = (i: number) =>
    (Math.floor(i / oldWidth) + margin) * width + (i % oldWidth) + margin;
  const tiles: Tile[] = Array.from({ length: width * height }, () => ({
    t: 0,
    owner: 0,
    fertility: 0.1,
    ore: 0,
    damage: 0,
    wood: 0,
    mineral: 0,
    road: 0,
  }));
  w.tiles.forEach((t, i) => {
    tiles[tileIndex(i)] = t;
  });
  for (const n of w.nations) n.capital = tileIndex(n.capital);
  for (const e of w.history)
    if (e.tile !== undefined) e.tile = tileIndex(e.tile);
  for (const e of w.effects) e.tile = tileIndex(e.tile);
  for (const s of w.settlers) s.tile = tileIndex(s.tile);
  if (w.life) {
    for (const c of w.life.settlements) c.tile = tileIndex(c.tile);
    for (const u of [...w.life.citizens, ...w.life.armies]) {
      u.x += margin;
      u.y += margin;
      u.previousX += margin;
      u.previousY += margin;
      u.route = u.route.map(tileIndex);
    }
    for (const c of w.life.citizens) c.goal = tileIndex(c.goal);
    for (const a of w.life.armies) a.target = tileIndex(a.target);
  }
  w.width = width;
  w.height = height;
  w.tiles = tiles;
  w.cartographyRevision = 2;
  return w;
}
