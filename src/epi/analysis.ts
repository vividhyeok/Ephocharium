import { foundingNationCap, foundingRules } from "../settlement";
import { architecture, civicRules, faithPractice } from "../civic";
import { FAITHS } from "../culture";
import type { World, Nation } from "../engine";
import { eraOf } from "../eras";
import { developmentGate } from "../progression";
import { leaderLabels } from "../archives";
import { metrics } from "./metrics";
import type { EpiContext } from "./protocol";
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
  const mentions = (value: string) =>
    w.nations.filter((n) =>
      [n.name, n.culture?.baseName].some(
        (name) => name && value.includes(name),
      ),
    );
  const direct = mentions(question);
  const named = direct.length ? direct : mentions(previous);
  const focusIds = [
    ...new Set(
      direct.length
        ? direct.map((n) => n.id)
        : [selected, ...named.map((n) => n.id)].filter(Boolean),
    ),
  ].slice(0, 24);
  const relative = question.match(/(\d[\d,]*)\s*년\s*전/);
  const period =
    question.match(/(?:최근|지난)\s*(\d[\d,]*)\s*년/) ||
    question.match(/(\d[\d,]*)\s*년\s*동안/);
  const absolute = question.match(/(\d[\d,]*)\s*년/);
  const targetYear = relative
    ? w.year - Number(relative[1].replaceAll(",", ""))
    : period
      ? w.year - Number(period[1].replaceAll(",", ""))
      : absolute
        ? Number(absolute[1].replaceAll(",", ""))
        : null;
  const historical =
    targetYear !== null || /과거|변화|추세|예전|당시/.test(question);
  const balances = w.archive?.balances || [];
  const past = [...balances]
    .reverse()
    .find((b) => b.year <= (targetYear ?? w.year - 100));
  const topicMetric = /인구|출산|사망/.test(question)
    ? "population"
    : /재산|경제|부유/.test(question)
      ? "economy"
      : /기술|발전|시대/.test(question)
        ? "technology"
        : /영토|크기/.test(question)
          ? "territory"
          : /군사|병력/.test(question)
            ? "military"
            : /동맹/.test(question)
              ? "alliances"
              : "power";
  const priorityIds = [
    ...new Set([...focusIds, ...rankings[topicMetric].map((n) => n.id)]),
  ];
  const ids = [
    ...new Set([
      ...priorityIds,
      ...rankings.power.slice(0, 3).map((n) => n.id),
      ...(/강|순위|비교|세력/.test(question)
        ? metrics.flatMap((m) => rankings[m].slice(0, 1).map((n) => n.id))
        : []),
      ...(/지도자|왕|각 국가/.test(question)
        ? alive.slice(0, 16).map((n) => n.id)
        : []),
      ...(historical
        ? past?.nations
            .slice()
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
      const timeline = new Map<
        number,
        NonNullable<EpiContext["nations"][number]["trends"]>[number]
      >();
      for (const point of n.samples) timeline.set(point.year, { ...point });
      for (const frame of balances) {
        const point = frame.nations.find((p) => p.id === n.id);
        if (point) timeline.set(frame.year, { ...point, year: frame.year });
      }
      const ordered = [...timeline.values()].sort((a, b) => a.year - b.year);
      const trendTarget =
        targetYear === null
          ? undefined
          : ordered.filter((p) => p.year <= targetYear).at(-1);
      const trends = [
        ...new Map(
          [ordered[0], trendTarget, ...ordered.slice(-10)]
            .filter((p) => p !== undefined)
            .map((p) => [p.year, p]),
        ).values(),
      ].sort((a, b) => a.year - b.year);
      const d = n.demography;
      const shape = architecture(w, n),
        rule = n.strategy?.institution;
      return {
        identity: {
          architecture: shape.name,
          architectureReason: shape.reason,
          faith: n.culture ? FAITHS[n.culture.faith]?.name : undefined,
          practice: n.culture ? faithPractice[n.culture.faith] : undefined,
          rule: rule ? civicRules[rule.rule].name : undefined,
          basis: rule?.basis,
        },
        trends,
        foundedYear: n.foundedYear,
        parentId: n.parentId,
        strategy: n.strategy && {
          year: n.strategy.year,
          reason: n.strategy.reason.slice(0, 300),
          priority: n.strategy.priority,
          investment: n.strategy.investment,
        },
        demography: d && {
          births: round(d.births),
          deaths: round(d.deaths),
          capacity: round(d.capacity),
          lifeExpectancy: round(d.lifeExpectancy),
        },
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
        eras: (n.eraHistory || []).slice(-8),
        leaderCount: term?.leaderCount || 0,
        leaders: [
          ...new Map(
            [
              ...(term?.leaders || [])
                .filter(
                  (l) =>
                    targetYear !== null &&
                    l.from <= targetYear &&
                    (l.to === undefined || l.to > targetYear),
                )
                .slice(-1),
              ...(term?.leaders || []).slice(-7),
            ].map((l) => [l.from, l]),
          ).values(),
        ].map((l) => ({
          name: l.name,
          from: l.from,
          traits: leaderLabels(l.traits),
          ...(l.to === undefined ? {} : { to: l.to }),
        })),
      };
    });
  const requestedYear = Math.max(0, targetYear ?? past?.year ?? w.year);
  const comparison = historical
    ? {
        requestedYear,
        observedYear: past?.year ?? null,
        reason: past
          ? "표시된 연도에 보존된 실제 집계입니다."
          : "국력 집계는 없지만 국가별 인구·영토 기록과 사건은 별도로 확인하세요.",
        nations: ids
          .flatMap((id) => past?.nations.filter((n) => n.id === id) || [])
          .slice(0, 12),
      }
    : null;
  const diplomatic = /전쟁|휴전|평화|동맹|외교|조공|약탈|종속/.test(question);
  const topic = /정책|개혁|연구|발전/.test(question)
    ? /정책|개혁|연구|발전|시대/
    : /인구|이주|건국|독립/.test(question)
      ? /이주|건국|독립|인구|멸망/
      : null;
  const diplomaticEvents = (w.diplomacyLog || []).map((e) => ({
    year: e.year,
    nations: [e.a, e.b],
    text: `${{ war: "전쟁", peace: "휴전", alliance: "동맹", break: "동맹 파기", raid: "약탈", subjugation: "종속", independence: "독립", support: "지원" }[e.kind]}: ${w.nations[e.a - 1]?.name} · ${w.nations[e.b - 1]?.name} · ${e.reason}`,
  }));
  const sources = diplomatic ? diplomaticEvents : w.history;
  const events = [...sources]
    .filter(
      (e) =>
        targetYear === null ||
        (period ? e.year >= targetYear : e.year <= targetYear),
    )
    .sort((a, b) => {
      const relevance = (e: typeof a) =>
        focusIds.filter((id) => e.nations.includes(id)).length * 4 +
        (topic?.test(e.text) ? 1 : 0);
      return relevance(b) - relevance(a) || b.year - a.year;
    })
    .slice(0, 24)
    .sort((a, b) => a.year - b.year)
    .map((e) => ({
      year: e.year,
      text: e.text.slice(0, 300),
      nations: e.nations.slice(0, 12),
      ...("tile" in e && typeof e.tile === "number" ? { tile: e.tile } : {}),
    }));
  const indexIds = [
    ...new Set([
      ...ids,
      ...events.flatMap((e) => e.nations),
      ...alive.map((n) => n.id),
      ...w.nations.map((n) => n.id).reverse(),
    ]),
  ].slice(0, 128);
  return compactContext({
    year: w.year,
    knownSince: w.archive?.knownSince ?? w.year,
    overview: getWorldOverview(w),
    matchedIds: focusIds,
    founding: /건국|신생|탄생|새 나라|새 국가|멸망|망하/.test(question)
      ? {
          settlers: w.settlers.length,
          cap: foundingNationCap(w),
          alive: alive.length,
          enabled: w.preset !== "empty",
          ...foundingRules,
          recentFounded: w.nations.filter(
            (n) => n.foundedYear !== undefined && n.foundedYear >= w.year - 100,
          ).length,
          recentFoundedFallen: w.nations.filter(
            (n) =>
              !n.alive &&
              n.foundedYear !== undefined &&
              n.foundedYear >= w.year - 100,
          ).length,
          conditions:
            "독립 이주에는 모국 인구와 나이, 이동 가능한 빈 농지, 도시의 식량과 이동 보급이 필요합니다. 이 한도는 독립 이주 출발에 적용되며 다른 형태의 건국과는 별개입니다.",
        }
      : undefined,
    index: indexIds
      .map((id) => w.nations[id - 1])
      .filter(Boolean)
      .map((n) => ({
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
          focusIds.filter((id) => b.a === id || b.b === id).length -
            focusIds.filter((id) => a.a === id || a.b === id).length ||
          Number(b.war) - Number(a.war) ||
          Number(b.allied) - Number(a.allied),
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
    notFound: [],
    warnings: [],
  });
}

export function compactContext(c: EpiContext): EpiContext {
  const size = () => new TextEncoder().encode(JSON.stringify(c)).length;
  if (size() <= 35000) return c;
  c.warnings.push(
    "전송 예산에 따라 세부 도시·지도자·사건·국가 자료 일부만 추렸습니다. 없는 자료를 전체 상태로 가정하지 마세요.",
  );
  for (let round = 0; round < 6 && size() > 35000; round++) {
    for (const n of c.nations) {
      if (!c.matchedIds?.includes(n.id)) n.trends = n.trends?.slice(-4);
      n.cities = n.cities.slice(0, Math.floor(n.cities.length / 2));
      n.leaders = n.leaders.slice(0, Math.floor(n.leaders.length / 2));
      n.causes = n.causes.slice(0, Math.floor(n.causes.length / 2));
    }
    c.events = c.events.slice(-Math.max(1, Math.floor(c.events.length / 2)));
    c.relations = c.relations.slice(
      0,
      Math.max(4, Math.floor(c.relations.length / 2)),
    );
    if (round > 0) {
      c.index = c.index
        .filter((n) => c.nations.some((x) => x.id === n.id))
        .slice(0, 24);
      c.nations = c.nations.slice(
        0,
        Math.max(
          c.matchedIds?.length || 0,
          4,
          Math.floor(c.nations.length / 2),
        ),
      );
      for (const key of metrics) c.rankings[key] = c.rankings[key].slice(0, 3);
    }
  }
  return c;
}
