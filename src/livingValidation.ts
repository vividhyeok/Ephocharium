import type { World } from "./engine";
import { MATERIALS } from "./livingTypes";
export function validateLiving(w: World) {
  if (w.living === undefined) return true;
  const s = w.living,
    n = (v: unknown, a = 0, b = 1e12) =>
      typeof v === "number" && Number.isFinite(v) && v >= a && v < b,
    id = (v: number) => Number.isInteger(v) && v > 0 && v <= w.nations.length,
    tile = (v: number) => Number.isInteger(v) && v >= 0 && v < w.tiles.length,
    cohorts = (v: unknown) =>
      Array.isArray(v) && v.length === 3 && v.every((x) => n(x)),
    stock = (v: any) => v && MATERIALS.every((k) => n(v[k]));
  if (
    !s ||
    s.revision !== 5 ||
    !n(s.nextId) ||
    !n(s.landRevision) ||
    !n(s.geographyRevision) ||
    !n(s.lastNetwork, -1000) ||
    ![s.trade, s.migrants, s.births, s.deaths, s.lostCargo].every((v) => n(v))
  )
    return false;
  if (
    !w.tiles.every(
      (t, i) =>
        n(t.elevation, -10, 10) &&
        n(t.spill, -10, 100) &&
        n(t.flow) &&
        n(t.river, 0, 4) &&
        n(t.depth, 0, 10) &&
        n(t.moisture, 0, 1.1) &&
        n(t.temperature, 0, 10) &&
        Number.isInteger(t.downstream) &&
        (t.downstream === -1 ||
          (tile(t.downstream!) && w.tiles[t.downstream!].spill! < t.spill!)) &&
        typeof t.lake === "boolean" &&
        (!t.deposits ||
          Object.entries(t.deposits).every(
            ([k, v]) => MATERIALS.includes(k as any) && n(v),
          )),
    )
  )
    return false;
  if (
    !w.nations.every(
      (x) =>
        (!x.culture ||
          (Number.isInteger(x.culture.id) &&
            x.culture.id >= 0 &&
            x.culture.id < 5 &&
            Number.isInteger(x.culture.faith) &&
            x.culture.faith >= 0 &&
            x.culture.faith < 5 &&
            x.culture.shares.length === 5 &&
            x.culture.shares.every((v) => n(v, 0, 1.01)) &&
            x.culture.deeds.length <= 100 &&
            x.culture.deeds.every(
              (t) => typeof t === "string" && t.length < 2000,
            ))) &&
        (!x.inventory || stock(x.inventory)) &&
        (!x.demography ||
          (cohorts(x.demography.cohorts) &&
            Object.entries(x.demography).every(
              ([k, v]) =>
                k === "cohorts" || n(v, k === "migration" ? -1e12 : 0),
            ))),
    )
  )
    return false;
  if (
    !w.life?.settlements.every(
      (c) =>
        !c.urban ||
        (stock(c.urban.stock) &&
          cohorts(c.urban.cohorts) &&
          c.urban.roles.length <= 8 &&
          c.urban.roles.every((r) =>
            [
              "farm",
              "mine",
              "industry",
              "port",
              "faith",
              "capital",
              "research",
              "junction",
            ].includes(r),
          ) &&
          Object.entries(c.urban).every(
            ([k, v]) =>
              typeof v !== "number" ||
              n(v, k === "growth" || k === "portTile" ? -1e12 : 0),
          ) &&
          c.urban.causes.length <= 20 &&
          c.urban.causes.every(
            (c) =>
              typeof c.label === "string" &&
              n(c.value, -1e12) &&
              n(c.effect, -1e12),
          )),
    )
  )
    return false;
  if (
    !Array.isArray(s.routes) ||
    s.routes.length > 260 ||
    !s.routes.every(
      (r) =>
        n(r.id) &&
        n(r.capacity) &&
        n(r.delivered) &&
        r.path.length <= w.tiles.length &&
        r.path.every(tile) &&
        ["road", "rail", "river", "sea", "air"].includes(r.mode),
    )
  )
    return false;
  if (
    !Array.isArray(s.vehicles) ||
    s.vehicles.length > 256 ||
    !s.vehicles.every(
      (v) =>
        n(v.id) &&
        id(v.nation) &&
        id(v.targetNation) &&
        v.path.length <= w.tiles.length &&
        v.path.every(tile) &&
        n(v.progress) &&
        n(v.previousProgress) &&
        Object.entries(v.cargo).every(
          ([k, v]) => MATERIALS.includes(k as any) && n(v),
        ) &&
        (!v.people || cohorts(v.people)) &&
        [
          "trade",
          "migration",
          "escort",
          "landing",
          "support",
          "airlift",
        ].includes(v.purpose),
    )
  )
    return false;
  return (
    Array.isArray(s.monuments) &&
    s.monuments.length <= 512 &&
    s.monuments.every(
      (m) =>
        tile(m.tile) &&
        id(m.nation) &&
        n(m.condition, 0, 1.01) &&
        n(m.year) &&
        typeof m.reason === "string",
    )
  );
}
