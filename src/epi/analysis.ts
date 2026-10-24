import type { World, Nation } from "../engine";
import { eraOf } from "../eras";
import { developmentGate } from "../progression";
import { leaderLabels } from "../archives";
import {metrics} from './metrics';
import type {EpiContext} from './protocol';
const round = (v: number) =>
  Math.round(Math.max(0, Number.isFinite(v) ? v : 0) * 100) / 100;
export function getWorldOverview(w: World) {
  const alive = w.nations.filter((n) => n.alive),
    a = w.archive,
    wars = w.relations.filter((r) => r.war).length;
  return {
    population: round(alive.reduce((s, n) => s + n.population, 0)),
    alive: alive.length,
    wars,
    alliances: w.relations.filter((r) => r.allied).length,
    peaceYears: wars
      ? 0
      : a?.peaceSince === null || a?.peaceSince === undefined
        ? null
        : w.year - a.peaceSince,
    lastWarStart: a?.lastWarStart ?? null,
    lastWarEnd: a?.lastWarEnd ?? null,
    recordGap: !a || a.knownSince > 0,
  };
}
export function analyzeWorld(
  w: World,
  question: string,
  selected = 0,
  previous = "",
): EpiContext {
  const alive = w.nations.filter((n) => n.alive),
    military = new Map<number, number>();
  for (const a of w.life?.armies || [])
    military.set(a.nation, (military.get(a.nation) || 0) + a.strength);
  const score = (n: Nation, m: (typeof metrics)[number]) =>
    m === "population"
      ? n.population
      : m === "economy"
        ? n.wealth
        : m === "military"
          ? military.get(n.id) || 0
          : m === "technology"
            ? n.tech
            : m === "territory"
              ? n.territory
              : m === "alliances"
                ? w.relations.filter(
                    (r) => r.allied && (r.a === n.id || r.b === n.id),
                  ).length
                : 0;
  const weights = [0.25, 0.15, 0.2, 0.2, 0.1, 0.1],
    parts = metrics.slice(1),
    maxima = parts.map((m) => Math.max(1, ...alive.map((n) => score(n, m))));
  const power = (n: Nation) =>
    parts.reduce(
      (s, m, k) =>
        s +
        ((weights[k] * Math.log1p(score(n, m))) / Math.log1p(maxima[k])) * 100,
      0,
    );
  const rankings = Object.fromEntries(
    metrics.map((m) => [
      m,
      [...alive]
        .sort(
          (a, b) =>
            (m === "power" ? power(b) - power(a) : score(b, m) - score(a, m)) ||
            a.id - b.id,
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          name: n.name.slice(0, 150),
          value: round(m === "power" ? power(n) : score(n, m)),
        })),
    ]),
  ) as EpiContext["rankings"];
  const named = w.nations.filter((n) =>
    [n.name, n.culture?.baseName].some(
      (name) => name && (question + " " + previous).includes(name),
    ),
  );
  const ids = [
    ...new Set([
      selected,
      ...named.map((n) => n.id),
      ...rankings.power.slice(0, 3).map((n) => n.id),
      ...(/강|순위|비교|세력/.test(question)
        ? metrics.flatMap((m) => rankings[m].slice(0, 1).map((n) => n.id))
        : []),
      ...(/지도자|왕|각 국가/.test(question)
        ? alive.slice(0, 16).map((n) => n.id)
        : []),
      ...(/년\s*전|과거/.test(question)
        ? [...(w.archive?.balances || [])]
            .reverse()
            .find(
              (b) =>
                b.year <=
                w.year -
                  Number(question.match(/(\d{1,5})\s*년\s*전/)?.[1] || 300),
            )
            ?.nations.slice()
            .sort((a, b) => b.population - a.population)
            .slice(0, 5)
            .map((n) => n.id) || []
        : []),
    ]),
  ]
    .filter(Boolean)
    .slice(0, 24);
  const nations = ids
    .map((id) => w.nations.find((n) => n.id === id))
    .filter((n): n is Nation => !!n)
    .map((n) => {
      const rel = w.relations.filter((r) => r.a === n.id || r.b === n.id),
        sample = [...n.samples].reverse().find((s) => s.year <= w.year - 100),
        term = w.archive?.nations[n.id];
      return {
        id: n.id,
        name: n.name.slice(0, 150),
        shortName: (n.culture?.baseName || n.name).slice(0, 100),
        alive: n.alive,
        level: eraOf(n) + 1,
        tech: round(n.tech),
        population: round(n.population),
        wealth: round(n.wealth),
        territory: n.territory,
        stability: round(n.stability),
        food: round(n.food),
        military: round(military.get(n.id) || 0),
        policy: {
          aggression: round(n.aggression),
          tendencies: Object.fromEntries(
            Object.entries(n.tendencies || {}).map(([k, v]) => [k, round(v)]),
          ),
          energy: round(
            w.life?.polities.find((p) => p.nation === n.id)?.energy || 0,
          ),
        },
        allies: rel
          .filter((r) => r.allied)
          .map((r) => (r.a === n.id ? r.b : r.a))
          .slice(0, 128),
        enemies: rel
          .filter((r) => r.war)
          .map((r) => (r.a === n.id ? r.b : r.a))
          .slice(0, 128),
        power: round(power(n)),
        leader: {
          name: n.leader,
          traits: n.leaderTraits
            ? leaderLabels(n.leaderTraits)
            : ["기록 이전 정보 부족"],
          since: n.leaderTraits?.since ?? w.year,
          regime:
            w.life?.polities.find((p) => p.nation === n.id)?.regime ||
            "unknown",
        },
        growth: sample
          ? Math.round((n.population - sample.population) * 100) / 100
          : null,
        gate: developmentGate(w, n),
        cityCount:
          w.life?.settlements.filter((c) => c.nation === n.id).length || 0,
        cities: (w.life?.settlements.filter((c) => c.nation === n.id) || [])
          .slice(0, 12)
          .map((c) => ({
            name: c.name.slice(0, 150),
            population: round(c.population),
            stage: c.development,
            status: c.urban?.lifecycle || "active",
            operation: c.urban?.operation ?? 1,
          })),
        resources: Object.fromEntries(
          Object.entries(n.inventory || {}).map(([k, v]) => [k, round(v)]),
        ),
        causes: (
          w.life?.settlements.find((c) => c.nation === n.id)?.urban?.causes ||
          []
        )
          .slice(0, 5)
          .map((c) => ({
            ...c,
            value: Math.round(c.value * 100) / 100,
            effect: Math.round(c.effect * 100) / 100,
          })),
        wars: term?.wars || 0,
        eras:(n.eraHistory||[]).slice(-8),
        leaderCount:term?.leaderCount||0,
        leaders: [...new Map([...(term?.leaders||[]).filter(l=>/년\s*전|과거/.test(question)&&l.from<=w.year-Number(question.match(/(\d{1,5})\s*년\s*전/)?.[1]||300)&&(l.to===undefined||l.to>=w.year-Number(question.match(/(\d{1,5})\s*년\s*전/)?.[1]||300))).slice(-1),...(term?.leaders||[]).slice(-7)].map(l=>[l.from,l])).values()].map((l) => ({
          name: l.name,
          from: l.from,
          traits:leaderLabels(l.traits),
          ...(l.to === undefined ? {} : { to: l.to }),
        })),
      };
    });
  const years = Number(question.match(/(\d{1,5})\s*년\s*전/)?.[1] || 300),
    requestedYear = Math.max(0, w.year - years),
    past = [...(w.archive?.balances || [])]
      .reverse()
      .find((b) => b.year <= requestedYear);
  const historical = /년\s*전|과거|세력|변화|균형/.test(question);
  const comparison = historical
    ? {
        requestedYear,
        observedYear: past?.year ?? null,
        reason: past
          ? "50년 간격의 보존된 집계입니다."
          : "이 시점의 집계 기록이 없습니다.",
        nations: (past?.nations || [])
          .filter((n) => ids.includes(n.id))
          .slice(0, 12),
      }
    : null;
  const warQuestion = /전쟁|휴전|평화/.test(question);
  const sources = warQuestion
    ? (w.diplomacyLog || [])
        .filter((e) => e.kind === "war" || e.kind === "peace")
        .map((e) => ({
          year: e.year,
          text:
            (e.kind === "war" ? "전쟁 발발: " : "평화 협정: ") +
            w.nations[e.a - 1].name +
            " · " +
            w.nations[e.b - 1].name +
            " · " +
            e.reason,
          nations: [e.a, e.b],
          importance: "major",
          tile: undefined as number | undefined,
        }))
    : w.history;
  const events = sources
    .filter(
      (e) =>
        !selected || e.nations.includes(selected) || e.importance === "major",
    )
    .slice(-18)
    .map((e) => ({
      year: e.year,
      text: e.text.slice(0, 300),
      nations: e.nations.slice(0, 12),
      ...(e.tile === undefined ? {} : { tile: e.tile }),
    }));
  return compactContext({
    year: w.year,
    knownSince: w.archive?.knownSince ?? w.year,
    overview: getWorldOverview(w),
    index: w.nations.slice(0, 128).map((n) => ({
      id: n.id,
      name: n.name.slice(0, 150),
      shortName: (n.culture?.baseName || n.name).slice(0, 100),
      alive: n.alive,
    })),
    nations,
    rankings,
    events,
    relations: w.relations
      .filter((r) => ids.includes(r.a) || ids.includes(r.b))
      .sort(
        (a, b) =>
          Number(b.war) - Number(a.war) || Number(b.allied) - Number(a.allied),
      )
      .slice(0, 40)
      .map((r) => ({
        a: r.a,
        b: r.b,
        war: r.war,
        allied: !!r.allied,
        since: r.allied ? (r.allianceSince ?? r.since) : r.since,
        reason: (r.reason || "상세 원인 기록 없음").slice(0, 300),
      })),
    comparison,
    notFound: [],warnings:[],
  });
}

export function compactContext(c:EpiContext):EpiContext {
 const size=()=>new TextEncoder().encode(JSON.stringify(c)).length;
 if(size()<=35000)return c;
 c.warnings.push('전송 예산에 따라 세부 도시·지도자·사건·국가 자료 일부만 추렸습니다. 없는 자료를 전체 상태로 가정하지 마세요.');
 for(let round=0;round<6&&size()>35000;round++){
  for(const n of c.nations){n.cities=n.cities.slice(0,Math.floor(n.cities.length/2));n.leaders=n.leaders.slice(0,Math.floor(n.leaders.length/2));n.causes=n.causes.slice(0,Math.floor(n.causes.length/2));}
  c.events=c.events.slice(-Math.max(1,Math.floor(c.events.length/2)));c.relations=c.relations.slice(0,Math.max(4,Math.floor(c.relations.length/2)));
  if(round>0){c.index=c.index.filter(n=>c.nations.some(x=>x.id===n.id)).slice(0,24);c.nations=c.nations.slice(0,Math.max(4,Math.floor(c.nations.length/2)));for(const key of metrics)c.rankings[key]=c.rankings[key].slice(0,3);}
 }
 return c;
}
