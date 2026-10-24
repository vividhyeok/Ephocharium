import { useEffect, useRef, useState } from "react";
import type { World } from "../engine";
export interface Report {
  id: string;
  text: string;
  year: number;
  tile?: number;
  nation?: number;
}
export function useEpiReports(w: World | undefined, enabled: boolean) {
  const [report, setReport] = useState<Report | null>(null),
    state = useRef<
      | {
          key: string;
          year: number;
          population: number;
          topEra: number;
          last: number;
          seen: Set<string>;
        }
      | undefined
    >(undefined);
  useEffect(() => {
    if (!w) return;
    const key = w.worldId || "legacy:" + w.seed,
      alive = w.nations.filter((n) => n.alive),
      pop = alive.reduce((s, n) => s + n.population, 0),
      era = Math.max(0, ...(w.life?.polities.map((p) => p.era) || []));
    if (
      !state.current ||
      state.current.key !== key ||
      w.year < state.current.year
    ) {
      state.current = {
        key,
        year: w.year,
        population: pop,
        topEra: era,
        last: 0,
        seen: new Set(),
      };
      setReport(null);
      return;
    }
    const s = state.current;
    if (w.year === s.year) return;
    const elapsed = w.year - s.year,
      candidates: Report[] = [];
    if (era >= 7 && s.topEra < 7)
      candidates.push({
        id: "industrial",
        text:
          w.archive?.knownSince === 0 &&
          Object.values(w.archive.nations).reduce(
            (s, n) => s + n.eraCounts.slice(7).reduce((a, b) => a + b, 0),
            0,
          ) === 1
            ? "창조주님, 이 세계에 첫 산업 문명이 나타났어요."
            : "창조주님, 산업 문명이 새롭게 모습을 드러냈어요.",
        year: w.year,
        nation: alive.find((n) => n.tech >= 26)?.id,
      });
    if (s.population > 100 && pop < s.population * 0.8 && elapsed <= 100)
      candidates.push({
        id: "loss:" + Math.floor(w.year / 100),
        text: "창조주님, 세계 인구가 크게 줄었어요. 원인을 함께 살펴볼까요?",
        year: w.year,
      });
    for (const e of w.history
      .filter(
        (e) =>
          e.year > s.year &&
          (/개척선이 도착/.test(e.text) ||
            (/멸망/.test(e.text) &&
              e.nations.some((id) => (w.nations[id - 1]?.peak || 0) >= 100)) ||
            (e.importance === "major" && /전쟁 발발/.test(e.text))),
      )
      .slice(-5))
      candidates.push({
        id: /개척선이 도착/.test(e.text)
          ? "colonization"
          : String(e.id || e.year + e.text),
        text: "창조주님, " + e.text.slice(0, 100),
        year: e.year,
        tile: e.tile,
        nation: e.nations[0],
      });
    if (
      !w.relations.some((r) => r.war) &&
      w.archive?.peaceSince !== null &&
      w.archive?.peaceSince !== undefined &&
      w.year - w.archive.peaceSince >= 100
    )
      candidates.push({
        id: "peace:" + w.archive.peaceSince,
        text: "창조주님, 기록된 평화가 100년 이상 이어지고 있어요.",
        year: w.year,
      });
    const levels = alive.map((n) => Math.floor(n.tech));
    if (
      levels.length > 1 &&
      Math.max(...levels) > 90 &&
      Math.min(...levels) < 7
    )
      candidates.push({
        id: "gap:" + Math.floor(w.year / 1000),
        text: "창조주님, 국가 간 기술 격차가 커졌어요. 발전 여건을 비교해 볼까요?",
        year: w.year,
      });
    const next = candidates.find((c) => !s.seen.has(c.id));
    if (enabled && next && Date.now() - s.last >= 60000) {
      s.last = Date.now();
      s.seen.add(next.id);
      if (s.seen.size > 200) s.seen.delete(s.seen.values().next().value!);
      setReport(next);
    }
    s.year = w.year;
    s.population = pop;
    s.topEra = era;
  }, [w, enabled]);
  useEffect(() => {
    if (!enabled) setReport(null);
  }, [enabled]);
  return { report, dismiss: () => setReport(null) };
}
