import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
await build({
  entryPoints: ["src/engine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-results/living-engine.mjs",
});
const { generate, step, validate } =
  await import("../test-results/living-engine.mjs");
const cases = process.argv.includes("--quick")
  ? [[42, 80, 3000]]
  : [
      [42, 80, 18000],
      [91, 112, 18000],
      [241026, 80, 18000],
      [91, 256, 3000],
    ];
const results = [];
for (const [seed, size, years] of cases) {
  const w = generate({
    seed,
    size,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
  const start = performance.now();
  for (let year = 1; year <= years; year++) {
    step(w);
    if (![1000, 3000, 5000, 10000, 18000].includes(year)) continue;
    const nations = w.nations.filter((n) => n.alive),
      cities = w.life.settlements,
      weighted = (k) =>
        nations.reduce(
          (s, n) => s + (n.demography?.[k] || 0) * n.population,
          0,
        ) /
        Math.max(
          1,
          nations.reduce((s, n) => s + n.population, 0),
        );
    const r = {
      seed,
      size,
      year,
      elapsedMs: Math.round(performance.now() - start),
      msPerYear: +((performance.now() - start) / year).toFixed(2),
      valid: validate(w),
      alive: nations.length,
      population: Math.round(nations.reduce((s, n) => s + n.population, 0)),
      eras: nations.map(
        (n) => w.life.polities.find((p) => p.nation === n.id)?.era,
      ),
      tech: nations.map((n) => +n.tech.toFixed(2)),
      lifeExpectancy: +weighted("lifeExpectancy").toFixed(1),
      fertility: +weighted("fertility").toFixed(2),
      pressure: +weighted("pressure").toFixed(2),
      cities: cities.length,
      agents: w.life.citizens.length,
      ports: cities.filter((c) => c.urban?.port).length,
      stations: cities.filter((c) => c.urban?.station).length,
      airports: cities.filter((c) => c.airport).length,
      routes: Object.fromEntries(
        ["road", "rail", "river", "sea", "air"].map((k) => [
          k,
          w.living.routes.filter((r) => r.mode === k).length,
        ]),
      ),
      delivered: w.living.routes.reduce((s, r) => s + r.delivered, 0),
      vehicles: w.living.vehicles.length,
      migrants: w.living.migrants,
      monuments: w.living.monuments.length,
      wars: w.diplomacyLog.filter((e) => e.kind === "war").length,
      alliances: w.diplomacyLog.filter((e) => e.kind === "alliance").length,
      bytes: Buffer.byteLength(JSON.stringify(w)),
      heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
    };
    results.push(r);
    console.log(JSON.stringify(r));
    writeFileSync("docs/benchmark-0.5.json", JSON.stringify(results, null, 2));
    if (seed === 42 && [1000, 3000, 10000, 18000].includes(year))
      writeFileSync(`test-results/natural-${year}.json`, JSON.stringify(w));
    if (!r.valid) throw Error("Invalid world");
  }
}
