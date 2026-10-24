import type { World, Nation } from "./engine";
import { hash } from "./geography";
import { eraOf } from "./eras";
export interface LeaderTraits {
  peace: number;
  diplomacy: number;
  ambition: number;
  caution: number;
  since: number;
  name: string;
}
export interface Archive {
  knownSince: number;
  lastWarStart: number | null;
  lastWarEnd: number | null;
  peaceSince: number | null;
  nations: Record<
    string,
    {
      wars: number;
      alliances: number;
      falls: number;
      leaderCount: number;
      leaders: {
        name: string;
        from: number;
        to?: number;
        traits: LeaderTraits;
      }[];
      eraCounts: number[];
    }
  >;
  balances: {
    year: number;
    nations: {
      id: number;
      population: number;
      tech: number;
      territory: number;
      wealth: number;
      military: number;
    }[];
  }[];
}
export function leaderTraits(w: World, n: Nation): LeaderTraits {
  if (n.leaderTraits?.name === n.leader) return n.leaderTraits;
  const since = n.culture?.reignSince ?? w.year;
  n.leaderTraits = {
    name: n.leader,
    since,
    peace: hash(w.seed + n.id, Math.floor(since), 11),
    diplomacy: hash(w.seed + n.id, Math.floor(since), 29),
    ambition: hash(w.seed + n.id, Math.floor(since), 41),
    caution: hash(w.seed + n.id, Math.floor(since), 67),
  };
  return n.leaderTraits;
}
export function prepareArchive(w: World) {
  w.archive ??= {
    knownSince: w.year,
    lastWarStart: null,
    lastWarEnd: null,
    peaceSince: w.relations.some((r) => r.war) ? null : w.year,
    nations: {},
    balances: [],
  };
  for (const n of w.nations) {
    const traits = leaderTraits(w, n);
    const entry = (w.archive.nations[n.id] ??= {
      wars: 0,
      alliances: 0,
      falls: 0,
      leaderCount: 0,
      leaders: [],
      eraCounts: Array(14).fill(0),
    });
    if (
      entry.leaders.at(-1)?.name !== n.leader ||
      entry.leaders.at(-1)?.from !== traits.since
    ) {
      const previous = entry.leaders.at(-1);
      if (previous && previous.to === undefined) previous.to = w.year;
      entry.leaderCount++;
      entry.leaders.push({
        name: n.leader,
        from: traits.since,
        traits: { ...traits },
      });
      if (entry.leaders.length > 80) entry.leaders.shift();
    }
  }
}
export function archiveYear(w: World) {
  prepareArchive(w);
  const a = w.archive!;
  if (w.relations.some((r) => r.war)) a.peaceSince = null;
  else a.peaceSince ??= w.year;
  if (w.year % 50 === 0) {
    a.balances.push({
      year: w.year,
      nations: w.nations
        .filter((n) => n.alive)
        .map((n) => ({
          id: n.id,
          population: n.population,
          tech: n.tech,
          territory: n.territory,
          wealth: n.wealth,
          military:
            w.life?.armies
              .filter((x) => x.nation === n.id)
              .reduce((s, x) => s + x.strength, 0) || 0,
        })),
    });
    if (a.balances.length > 400) a.balances.shift();
  }
}
export function leaderLabels(t: LeaderTraits) {
  return [
    t.peace > 0.65 ? "평화 중시" : t.peace < 0.3 ? "무력 용인" : "실리적 평화",
    t.diplomacy > 0.65
      ? "외교 적극"
      : t.diplomacy < 0.3
        ? "외교 소극"
        : "협상 실용",
    t.ambition > 0.65
      ? "확장 야심"
      : t.ambition < 0.3
        ? "내정 지향"
        : "제한적 확장",
    t.caution > 0.65 ? "신중함" : t.caution < 0.3 ? "과감함" : "균형 판단",
  ];
}
export function validateArchive(w: World) {
  try {
    const a = w.archive;
    if (!a) return true;
    const num = (x: unknown) =>
      typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1e12;
    const nullable = (x: unknown) => x === null || num(x);
    const traits = (t: LeaderTraits) =>
      t &&
      typeof t.name === "string" &&
      t.name.length < 300 &&
      num(t.since) &&
      [t.peace, t.diplomacy, t.ambition, t.caution].every(
        (x) => num(x) && x <= 1,
      );
    return (
      Array.isArray(w.nations) &&
      num(a.knownSince) &&
      nullable(a.lastWarStart) &&
      nullable(a.lastWarEnd) &&
      nullable(a.peaceSince) &&
      a.nations &&
      Object.keys(a.nations).length <= w.nations.length &&
      Object.keys(a.nations).every(
        (k) =>
          Number.isInteger(Number(k)) &&
          Number(k) > 0 &&
          Number(k) <= w.nations.length,
      ) &&
      Object.values(a.nations).every(
        (n) =>
          [n.wars, n.alliances, n.falls, n.leaderCount].every(num) &&
          Array.isArray(n.leaders) &&
          n.leaders.length <= 80 &&
          n.leaders.every(
            (l) =>
              typeof l.name === "string" &&
              num(l.from) &&
              (l.to === undefined || num(l.to)) &&
              traits(l.traits),
          ) &&
          n.eraCounts.length === 14 &&
          n.eraCounts.every(num),
      ) &&
      Array.isArray(a.balances) &&
      a.balances.length <= 400 &&
      a.balances.every(
        (b) =>
          num(b.year) &&
          b.nations.length <= w.nations.length &&
          b.nations.every((n) =>
            [
              n.id,
              n.population,
              n.tech,
              n.territory,
              n.wealth,
              n.military,
            ].every(num),
          ),
      ) &&
      w.nations.every((n) => !n.leaderTraits || traits(n.leaderTraits))
    );
  } catch {
    return false;
  }
}
