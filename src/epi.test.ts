import { it, expect } from "vitest";
import { generate, step, validate } from "./engine";
import { analyzeWorld } from "./epi/analysis";
import { contextSchema, queryEvidence, requestSchema } from "./epi/protocol";
import { leaderTraits, prepareArchive, archiveYear } from "./archives";
import { treaty, getRelation } from "./diplomacy";
import {
  trimConversation,
  historyForRequest,
  type Conversation,
} from "./epi/conversation";
import { demographicYear, sum } from "./demographics";
import { researchRate } from "./progression";
import { urbanYear } from "./living";
import { handleEpi, providerAnswer } from "../server/epi";
import { encodeSSE, readSSE } from "./epi/sse";
const make = () =>
  generate({
    seed: 42,
    size: 48,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
const env = {
  EPI_ENABLED: "true",
  EPI_ACCESS_TOKEN: "test-access-token-0123456789",
  DEEPSEEK_API_KEY: "test-key-not-real",
};
const request = (context = analyzeWorld(make(), "가장 강한 국가")) => ({
  requestId: crypto.randomUUID(),
  worldId: "test-world",
  question: "지금 가장 강한 국가가 어디야?",
  summary: "",
  messages: [],
  context,
});
const response = (chunks: unknown[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const chunk of chunks) c.enqueue(encodeSSE(chunk));
        c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        c.close();
      },
    }),
  );
it("queries are read only, bounded, distinguish missing nations, and never contain tiles or people positions", () => {
  const w = make(),
    before = JSON.stringify(w),
    c = analyzeWorld(w, "가장 강력한 국가와 300년 전 비교", 1);
  expect(contextSchema.safeParse(c).success).toBe(true);
  expect(JSON.stringify(c).length).toBeLessThan(96000);
  expect(JSON.stringify(c)).not.toContain("previousX");
  expect(queryEvidence(c, "getNationDetails", { ids: [999] })).toMatchObject({
    rows: [],
    missing: [999],
  });
  expect(c.comparison?.observedYear).toBe(null);
  expect(c.overview.recordGap).toBe(false);
  expect(() => queryEvidence(c, "executeCode", {})).toThrow();
  expect(() => queryEvidence(c, "rankNations", { metric: "hacked" })).toThrow();
  expect(JSON.stringify(w)).toBe(before);
});
it("leader succession persists separate personal traits without changing national aggression, including restore", () => {
  const w = make(),
    n = w.nations[0],
    policy = n.aggression,
    old = { ...leaderTraits(w, n) };
  n.leader = "후임 지도자";
  n.culture!.reignSince = 100;
  prepareArchive(w);
  expect(n.aggression).toBe(policy);
  expect(n.leaderTraits).not.toEqual(old);
  expect(
    leaderTraits(JSON.parse(JSON.stringify(w)), JSON.parse(JSON.stringify(n))),
  ).toEqual(n.leaderTraits);
  expect(w.archive!.nations[n.id].leaderCount).toBe(2);
  expect(w.archive!.nations[n.id].leaders[0].to).toBe(w.year);
});
it("war totals and peace duration outlive bounded logs; old saves do not invent lost history", () => {
  const w = make(),
    r = getRelation(w, 1, 2);
  w.year = 10;
  treaty(w, r, "war", "국경 분쟁", 1);
  w.year = 25;
  treaty(w, r, "peace", "휴전");
  w.history = [];
  w.diplomacyLog = [];
  w.year = 150;
  archiveYear(w);
  expect(w.archive!.lastWarStart).toBe(10);
  expect(w.archive!.nations[1].wars).toBe(1);
  expect(analyzeWorld(w, "전쟁 없던 기간").overview.peaceYears).toBe(125);
  delete w.archive;
  w.year = 500;
  prepareArchive(w);
  expect(w.archive!.knownSince).toBe(500);
  expect(w.archive!.lastWarStart).toBe(null);
});
it("demographic accounting exactly conserves cohort flows and never creates migrants", () => {
  const w = make(),
    u = w.life!.settlements[0].urban!;
  u.cohorts = [20, 50, 30];
  u.stock.food = 0;
  u.capacity = 60;
  const before = sum(u.cohorts),
    result = demographicYear(u, 9, 0.5, true, 1);
  expect(sum(u.cohorts)).toBeCloseTo(before + result.births - u.deaths, 8);
  expect(u.cohorts.every((v) => v >= 0)).toBe(true);
  expect(result.deaths).toBe(u.deaths);
});
it("unmanned cities decline into ruins and advanced knowledge cannot sustain on tiny population", () => {
  const w = make(),
    n = w.nations[0],
    c = w.life!.settlements.find((c) => c.nation === n.id)!;
  c.urban!.cohorts = [0, 0, 0];
  c.population = 0;
  c.urban!.builtEra = 9;
  c.development = 9;
  n.tech = 80;
  n.population = 2;
  const owned = new Map(
    w.nations.map((n) => [
      n.id,
      w.tiles.map((t, i) => (t.owner === n.id ? i : -1)).filter((i) => i >= 0),
    ]),
  );
  for (let i = 1; i <= 140; i++) {
    w.year = i;
    urbanYear(w, owned);
  }
  expect(c.urban!.lifecycle).toBe("ruin");
  expect(c.urban!.builtEra).toBeLessThan(9);
  n.population = 2;
  expect(researchRate(w, n)).toBeLessThan(0);
});
it("archive and lifecycle snapshots have an identical restored future", () => {
  const a = make();
  for (let i = 0; i < 80; i++) step(a);
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 80; i++) {
    step(a);
    step(b);
  }
  expect(b).toEqual(a);
  expect(validate(a)).toBe(true);
});
it("twenty turns keep only eight turns on the wire and summaries cannot grow without bounds", () => {
  const c: Conversation = { summary: "", messages: [] };
  for (let i = 0; i < 40; i++)
    c.messages.push({
      id: String(i),
      role: i % 2 ? "assistant" : "user",
      content: "세계 질문 " + i,
      year: i,
    });
  const trimmed = trimConversation({
    ...c,
    messages: [...c.messages, ...c.messages],
  });
  expect(trimmed.messages).toHaveLength(40);
  expect(trimmed.summary.length).toBeLessThanOrEqual(1600);
  expect(historyForRequest(trimmed)).toHaveLength(16);
});
it("provider supports streamed tool fragments, validates arguments, and continues a non-thinking conversation", async () => {
  const bodies: any[] = [],
    sent: any[] = [];
  const fetcher = (async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return bodies.length === 1
      ? response([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call1",
                      function: {
                        name: "rankNations",
                        arguments: '{"metric":',
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: '"power"}' } },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          },
        ])
      : response([
          {
            choices: [{ delta: { content: "창조주님, 관측 자료에 따르면 " } }],
          },
          {
            choices: [
              { delta: { content: "첫 국가입니다." }, finish_reason: "stop" },
            ],
          },
        ]);
  }) as typeof fetch;
  await providerAnswer(
    request(),
    env,
    (v) => sent.push(v),
    new AbortController().signal,
    fetcher,
  );
  expect(bodies).toHaveLength(2);
  expect(bodies[0].thinking).toEqual({ type: "disabled" });
  expect(bodies[1].messages.some((m: any) => m.role === "tool")).toBe(true);
  expect(
    sent
      .filter((s) => s.type === "delta")
      .map((s) => s.text)
      .join(""),
  ).toContain("관측 자료");
});
it("API enforces server access, payload limits and unknown schemas before any billed request", async () => {
  let calls = 0;
  const mock = (async () => {
    calls++;
    return response([]);
  }) as typeof fetch;
  const req = (body: any, token = env.EPI_ACCESS_TOKEN) =>
    new Request("http://localhost/api/epi", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Epi-Access": token },
      body: JSON.stringify(body),
    });
  expect((await handleEpi(req(request()), {}, mock)).status).toBe(503);
  expect((await handleEpi(req(request(), "wrong"), env, mock)).status).toBe(
    401,
  );
  expect(
    (await handleEpi(req({ ...request(), context: { evil: 1 } }), env, mock))
      .status,
  ).toBe(400);
  expect(
    (
      await handleEpi(
        req({ ...request(), question: "x".repeat(100000) }),
        env,
        mock,
      )
    ).status,
  ).toBe(413);
  expect(calls).toBe(0);
});
it("provider errors and truncated SSE are classified without retrying a possibly billed call", async () => {
  for (const [status, code] of [
    [400, "provider_request"],
    [401, "provider_auth"],
    [402, "balance"],
    [429, "provider_limit"],
    [503, "provider_unavailable"],
  ] as const) {
    let calls = 0;
    await expect(
      providerAnswer(
        request(),
        env,
        () => {},
        new AbortController().signal,
        (async () => {
          calls++;
          return new Response("", { status });
        }) as typeof fetch,
      ),
    ).rejects.toMatchObject({ code });
    expect(calls).toBe(1);
  }
  await expect(
    providerAnswer(
      request(),
      env,
      () => {},
      new AbortController().signal,
      (async () =>
        new Response(
          'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
        )) as typeof fetch,
    ),
  ).rejects.toMatchObject({ code: "stream_interrupted" });
  const bad = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("data: {"));
      c.close();
    },
  });
  await expect(async () => {
    for await (const _ of readSSE(bad)) {
    }
  }).rejects.toThrow("STREAM_TRUNCATED");
});
it("cancelling an API stream aborts its upstream and duplicate request ids cannot be billed twice", async () => {
  const body = request(),
    abort = new AbortController();
  let stopped = false;
  const mock = (async (_url: any, init: any) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        stopped = true;
        reject(new DOMException("abort", "AbortError"));
      });
    })) as typeof fetch;
  const req = () =>
    new Request("http://localhost/api/epi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Epi-Access": env.EPI_ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  const r = await handleEpi(req(), env, mock);
  expect(r.status).toBe(200);
  const reader = r.body!.getReader();
  await reader.read();
  abort.abort();
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 5));
  expect(stopped).toBe(true);
  expect((await handleEpi(req(), env, mock)).status).toBe(409);
});

it("authenticated requests are still rate limited server side without extra provider calls", async () => {
  let calls = 0,
    limited = 0;
  const fetcher = (async () => {
    calls++;
    return response([
      { choices: [{ delta: { content: "관측" }, finish_reason: "stop" }] },
    ]);
  }) as typeof fetch;
  for (let i = 0; i < 16; i++) {
    const req = new Request("http://localhost/api/epi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Epi-Access": env.EPI_ACCESS_TOKEN,
      },
      body: JSON.stringify(request()),
    });
    const r = await handleEpi(req, env, fetcher);
    await r.text();
    if (r.status === 429) limited++;
  }
  expect(limited).toBeGreaterThan(0);
  expect(calls).toBeLessThanOrEqual(12);
});

it("archives support more than 256 historical nations after repeated secessions", () => {
  const w = make();
  const template = structuredClone(w.nations[0]);
  while (w.nations.length < 300)
    w.nations.push({
      ...structuredClone(template),
      id: w.nations.length + 1,
      alive: false,
    });
  prepareArchive(w);
  expect(Object.keys(w.archive!.nations)).toHaveLength(300);
  expect(validate(w)).toBe(true);
});
