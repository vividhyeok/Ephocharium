import type { World, History } from "./engine";
import { eraOf } from "./eras";
export interface Chronicle {
  from: number;
  to: number;
  major: number;
  events: number;
  foundings: number;
  falls: number;
  wars: number;
  advances: number;
}
export interface Atlas {
  year: number;
  width: number;
  height: number;
  owners: number[];
}
export function enrichEvent(w: World, e: History, trackEra = true) {
  e.id = ++w.historySequence!;
  e.importance = /建国|건국|멸망|전쟁 발발|진입했습니다|행정 위기|독립/.test(
    e.text,
  )
    ? "major"
    : "normal";
  if (trackEra && /진입/.test(e.text))
    for (const id of e.nations) {
      const n = w.nations[id - 1];
      if (n) {
        n.eraHistory ??= [];
        n.eraHistory.push({ year: w.year, era: eraOf(n) });
        if (n.eraHistory.length > 100) n.eraHistory.shift();
      }
    }
  const from = Math.floor(e.year / 200) * 200;
  let c = w.chronicle!.find((c) => c.from === from);
  if (!c) {
    c = {
      from,
      to: from + 199,
      major: 0,
      events: 0,
      foundings: 0,
      falls: 0,
      wars: 0,
      advances: 0,
    };
    w.chronicle!.push(c);
    if (w.chronicle!.length > 120) w.chronicle!.shift();
  }
  c.events++;
  if (e.importance === "major") c.major++;
  if (/건국/.test(e.text)) c.foundings++;
  if (/멸망/.test(e.text)) c.falls++;
  if (/전쟁 발발/.test(e.text)) c.wars++;
  if (/진입/.test(e.text)) c.advances++;
}
export function captureAtlas(w: World) {
  if (w.year % 100 !== 0) return;
  const owners: number[] = [];
  for (const t of w.tiles) {
    if (owners.length && owners.at(-2) === t.owner) owners[owners.length - 1]++;
    else owners.push(t.owner, 1);
  }
  w.atlases!.push({ year: w.year, width: w.width, height: w.height, owners });
  if (w.atlases!.length > 8) w.atlases!.shift();
}
export function expandAtlas(a: Atlas) {
  const out: number[] = [];
  for (let i = 0; i < a.owners.length; i += 2)
    for (let k = 0; k < a.owners[i + 1]; k++) out.push(a.owners[i]);
  return out;
}
