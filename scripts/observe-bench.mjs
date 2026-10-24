import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
await build({
  entryPoints: ["src/engine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-results/engine-observe.mjs",
});
const { generate, step, validate } =
  await import("../test-results/engine-observe.mjs");
const cases = process.argv.includes("--quick")
  ? [[42, 80, 1000]]
  : [
      [42, 80, 18000],
      [91, 80, 18000],
      [241026, 80, 18000],
      [91, 256, 1000],
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
  let start = performance.now();
  for (let y = 1; y <= years; y++) {
    step(w);
    if (y % 1000 === 0 || y === 500) {
      const living = w.nations.filter((n) => n.alive);
      const result = {
        seed,
        size,
        year: y,
        elapsedMs: Math.round(performance.now() - start),
        valid: validate(w),
        totalNations: w.nations.length,
        alive: living.length,
        tech: living.map((n) => +n.tech.toFixed(3)),
        era: living.map(
          (n) => w.life.polities.find((p) => p.nation === n.id)?.era,
        ),
        population: Math.round(living.reduce((s, n) => s + n.population, 0)),
        cities: w.life.settlements.length,
        agents: w.life.citizens.length,
        wars: w.diplomacyLog.filter((e) => e.kind === "war").length,
        alliances: w.diplomacyLog.filter((e) => e.kind === "alliance").length,
        bytes: Buffer.byteLength(JSON.stringify(w)),
        heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
      };
      results.push(result);
      console.log(JSON.stringify(result));
      writeFileSync(
        process.argv.includes("--quick")
          ? "test-results/benchmark-quick.json"
          : "docs/benchmark-0.4.json",
        JSON.stringify(results, null, 2),
      );
      if (!result.valid) throw Error("Invalid long-run world");
    }
  }
}

for (const r of results) {
  if (r.year <= 1000 && r.era.length && r.era.every((e) => e === 13))
    throw Error("Civilizations reached the final era too early");
}
