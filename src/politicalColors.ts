import type { World } from "./engine";
/** Display-only alliance components; ownership and saved national identities never change. */
export function politicalColors(w: World) {
  const parent = w.nations.map((n) => n.id);
  const root = (id: number): number =>
    parent[id - 1] === id ? id : root(parent[id - 1]);
  for (const r of w.relations)
    if (
      r.allied &&
      !r.war &&
      w.nations[r.a - 1]?.alive &&
      w.nations[r.b - 1]?.alive
    ) {
      const a = root(r.a),
        b = root(r.b);
      parent[Math.max(a, b) - 1] = Math.min(a, b);
    }
  // A tributary keeps its identity and borders but shares the overlord's map tint.
  for (const r of w.relations) {
    if (!r.subject) continue;
    const overlord = r.subject === r.a ? r.b : r.a;
    if (!w.nations[r.subject - 1]?.alive || !w.nations[overlord - 1]?.alive) continue;
    const parentId = root(overlord);
    if (r.subject !== parentId) parent[r.subject - 1] = parentId;
  }
  return new Map(w.nations.map((n) => [n.id, w.nations[root(n.id) - 1].color]));
}
