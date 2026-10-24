import { z } from "zod";
const num = z.number().finite().min(0).max(1e12),
  text = z.string().max(300),
  nullable = num.nullable();
import {metrics} from './metrics.js';
export {metrics} from './metrics.js';
export const nationSchema = z
  .object({
    id: num.int(),
    name: text,
    shortName: text,
    alive: z.boolean(),
    level: num,
    tech: num,
    population: num,
    wealth: num,
    territory: num,
    stability: num,
    food: num,
    military: num,
    policy: z
      .object({
        aggression: num,
        tendencies: z.record(z.string().max(30), num),
        energy: num,
      })
      .strict(),
    allies: z.array(num).max(128),
    enemies: z.array(num).max(128),
    power: num,
    leader: z.object({
      name: text,
      traits: z.array(text).max(4),
      since: num,
      regime: text,
    }),
    growth: z.number().finite().min(-1e12).max(1e12).nullable(),
    gate: text,
    cityCount: num,
    cities: z
      .array(
        z.object({
          name: text,
          population: num,
          stage: num,
          status: text,
          operation: num,
        }),
      )
      .max(12),
    resources: z.record(z.string().max(20), num),
    causes: z
      .array(
        z.object({
          label: text,
          value: z.number().finite(),
          effect: z.number().finite(),
        }),
      )
      .max(5),
    wars: num,
    eras:z.array(z.object({era:num,year:num})).max(8),
    leaderCount:num,
    leaders: z
      .array(z.object({ name: text, from: num, to: num.optional(),traits:z.array(text).max(4) }))
      .max(8),
  })
  .strict();
export const eventSchema = z
  .object({
    year: num,
    text: text,
    nations: z.array(num).max(12),
    tile: num.optional(),
  })
  .strict();
export const contextSchema = z
  .object({
    year: num,
    knownSince: num,
    overview: z
      .object({
        population: num,
        alive: num,
        wars: num,
        alliances: num,
        peaceYears: nullable,
        lastWarStart: nullable,
        lastWarEnd: nullable,
        recordGap: z.boolean(),
      })
      .strict(),
    index: z
      .array(
        z.object({ id: num, name: text, shortName: text, alive: z.boolean() }),
      )
      .max(128),
    nations: z.array(nationSchema).max(24),
    rankings: z.record(
      z.enum(metrics),
      z.array(z.object({ id: num, name: text, value: num })).max(5),
    ),
    events: z.array(eventSchema).max(18),
    relations: z
      .array(
        z.object({
          a: num,
          b: num,
          war: z.boolean(),
          allied: z.boolean(),
          since: num,
          reason: text,
        }),
      )
      .max(40),
    comparison: z
      .object({
        requestedYear: num,
        observedYear: nullable,
        reason: text,
        nations: z
          .array(
            z.object({
              id: num,
              population: num,
              tech: num,
              territory: num,
              wealth: num,
              military: num,
            }),
          )
          .max(12),
      })
      .nullable(),
    notFound: z.array(text).max(8),
    warnings:z.array(text).max(4),
  })
  .strict();
export type EpiContext = z.infer<typeof contextSchema>;
export const requestSchema = z
  .object({
    requestId: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
    worldId: z.string().max(100),
    question: z.string().trim().min(1).max(1200),
    summary: z.string().max(1600),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(4000),
          })
          .strict(),
      )
      .max(16),
    context: contextSchema,
  })
  .strict();
export type EpiRequest = z.infer<typeof requestSchema>;
export const querySchema = z
  .object({
    metric: z.enum(metrics).optional(),
    ids: z.array(z.number().int().positive()).max(8).optional(),
    limit: z.number().int().min(1).max(8).optional(),
  })
  .strict();
export const toolNames = [
  "getWorldOverview",
  "rankNations",
  "compareNations",
  "getNationDetails",
  "getLeaderProfiles",
  "getDiplomaticRelations",
  "getWarHistory",
  "getPopulationTrends",
  "getRecentEvents",
] as const;
export function queryEvidence(c: EpiContext, name: string, args: unknown) {
  const q = querySchema.parse(args),
    ids = q.ids || [],
    rows = ids.length ? c.nations.filter((n) => ids.includes(n.id)) : c.nations;
  switch (name) {
    case "getWorldOverview":
      return { year: c.year, knownSince: c.knownSince, ...c.overview };
    case "rankNations":
      return {
        metric: q.metric || "power",
        rows: c.rankings[q.metric || "power"].slice(0, q.limit || 5),
        criteria:
          "종합=상대 로그 인구25%·재산15%·군사20%·기술20%·영토10%·직접 동맹10%. 각 부문 순위 별도.",
      };
    case "compareNations":
    case "getNationDetails":
      return {
        year: c.year,
        rows: rows.slice(0, q.limit || 8),
        missing: ids.filter((id) => !rows.some((n) => n.id === id)),
        historical: c.comparison,
      };
    case "getLeaderProfiles":
      return rows.slice(0, 8).map((n) => ({
        id: n.id,
        name: n.name,
        leader: n.leader,
        nationalTechnology: n.tech,
        wars: n.wars,
        leaders: n.leaders,
      }));
    case "getDiplomaticRelations":
      return c.relations
        .filter((r) => !ids.length || ids.includes(r.a) || ids.includes(r.b))
        .slice(0, 40);
    case "getWarHistory":
      return {
        knownSince: c.knownSince,
        lastStart: c.overview.lastWarStart,
        lastEnd: c.overview.lastWarEnd,
        peaceYears: c.overview.peaceYears,
        counts: rows.map((n) => ({ id: n.id, wars: n.wars })),
        events: c.events.filter((e) => /전쟁|휴전|평화/.test(e.text)),
      };
    case "getPopulationTrends":
      return {
        current: rows.map((n) => ({
          id: n.id,
          population: n.population,
          growth: n.growth,
        })),
        past: c.comparison,
      };
    case "getRecentEvents":
      return c.events.slice(-(q.limit || 8));
    default:
      throw Error("Unknown read-only query");
  }
}
