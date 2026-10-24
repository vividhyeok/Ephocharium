import { describe, it, expect } from "vitest";
import { generate, step, apply, burden, validate, type World } from "./engine";
const make = (seed = 42, preset: World["preset"] = "four", size = 80) =>
  generate({ seed, preset, size, sea: 0.4, forest: 0.35, mountains: 0.05 });
const run = (w: World, years: number) => {
  for (let i = 0; i < years; i++) step(w);
  return w;
};
describe("문명 시뮬레이션 A–H", () => {
  it("A: 인간 20명이 정착하고 국가를 형성한다", () => {
    const w = make(42, "empty");
    const i = w.tiles.findIndex((t) => t.t === 2);
    apply(w, "human", i);
    expect(w.settlers[0].population).toBe(20);
    run(w, 12);
    expect(w.nations[0].alive).toBe(true);
    expect(w.nations[0].population).toBeGreaterThan(20);
    expect(w.tiles.some((t) => t.owner === 1)).toBe(true);
  });
  it("B: 네 왕국이 확장하고 접경 외교와 전쟁이 변한다", () => {
    const w = make();
    const initial = w.tiles.filter((t) => t.owner).length;
    run(w, 650);
    console.log(
      "B 결과",
      w.nations.length,
      w.relations,
      w.history.filter((e) => /전쟁|평화/.test(e.text)).length,
    );
    expect(w.tiles.filter((t) => t.owner).length).toBeGreaterThan(initial);
    expect(w.relations.length).toBeGreaterThan(0);
    expect(w.relations.some((r) => r.score !== 0)).toBe(true);
    expect(w.history.some((e) => e.text.includes("전쟁"))).toBe(true);
  }, 15000);
  it("C: 인구와 자원 지원은 실제 상태와 성장 경로를 바꾼다", () => {
    const control = run(make(), 30);
    const aided = structuredClone(control);
    const tile = aided.nations[0].capital;
    apply(aided, "population", tile);
    apply(aided, "aid", tile);
    expect(
      aided.nations[0].population - control.nations[0].population,
    ).toBeCloseTo(100);
    expect(aided.nations[0].food).toBeGreaterThan(control.nations[0].food);
    run(control, 80);
    run(aided, 80);
    expect(aided.nations[0].population).not.toBe(control.nations[0].population);
  });
  it("D: 넓은 영토의 행정 부담은 기술로 완화된다", () => {
    const empire = make();
    empire.nations = empire.nations.slice(0, 1);
    for (const t of empire.tiles)
      t.owner = t.t === 2 || t.t === 3 || t.t === 1 ? 1 : 0;
    const n = empire.nations[0];
    n.population = 5000;
    n.food = 100000;
    n.wealth = 100000;
    const advanced = structuredClone(empire);
    advanced.nations[0].tech = 100;
    step(empire);
    step(advanced);
    expect(empire.nations[0].stability).toBeLessThan(
      advanced.nations[0].stability,
    );
    expect(burden(empire.nations[0])).toBeGreaterThan(
      burden(advanced.nations[0]),
    );
    run(empire, 180);
    expect(empire.history.some((e) => e.text.includes("행정 위기"))).toBe(true);
  });
  it("E: 재해 피해가 실제 인구와 생산에 반영되고 지형이 회복된다", () => {
    const w = run(make(), 30);
    const n = w.nations[0],
      pop = n.population;
    apply(w, "fire", n.capital, 3);
    expect(n.population).toBeLessThan(pop);
    expect(w.tiles[n.capital].damage).toBeGreaterThan(0);
    run(w, 50);
    expect(w.tiles[n.capital].damage).toBeLessThan(0.7);
    expect(w.nations.some((n) => n.alive)).toBe(true);
  });
  it("F: 같은 시드는 재현되고 다른 시드는 다른 결과를 만든다", () => {
    const a = run(make(1), 100),
      b = run(make(1), 100),
      c = run(make(2), 100);
    expect(a).toEqual(b);
    expect(a.nations.map((n) => n.population)).not.toEqual(
      c.nations.map((n) => n.population),
    );
  });
  it("G: 2,000년 동안 유한한 상태와 제한된 기록을 유지한다", () => {
    const start = performance.now();
    const w = run(make(91, "war", 112), 2000);
    const elapsed = performance.now() - start;
    console.log(
      "장기 실행",
      JSON.stringify({
        years: 2000,
        tiles: w.tiles.length,
        milliseconds: Math.round(elapsed),
        msPerYear: elapsed / 2000,
        nations: w.nations.length,
        alive: w.nations.filter((n) => n.alive).length,
        population: w.nations.reduce((a, n) => a + n.population, 0),
      }),
    );
    expect(
      w.nations.every(
        (n) => Number.isFinite(n.population) && n.population >= 0,
      ),
    ).toBe(true);
    expect(w.history.length).toBeLessThanOrEqual(1200);
    expect(w.nations.every((n) => n.samples.length <= 150)).toBe(true);
    expect(validate(w)).toBe(true);
  }, 60000);
  it("H: 저장/복원은 RNG와 이후의 역사까지 보존한다", () => {
    const w = run(make(), 150);
    const restored = JSON.parse(JSON.stringify(w));
    expect(validate(restored)).toBe(true);
    expect(restored).toEqual(w);
    run(w, 80);
    run(restored, 80);
    expect(restored).toEqual(w);
  });
  it("여섯 프리셋이 모두 유효한 세계를 생성한다", () => {
    for (const p of [
      "empty",
      "dawn",
      "four",
      "islands",
      "war",
      "observe",
    ] as const) {
      expect(validate(make(12, p))).toBe(true);
    }
  });
  it("바다에 인간을 놓아도 국가가 생기지 않는다", () => {
    const w = make(42, "empty");
    apply(
      w,
      "human",
      w.tiles.findIndex((t) => t.t === 0),
    );
    run(w, 10);
    expect(w.nations).toHaveLength(0);
  });
  it("손상된 중첩 데이터와 잘못된 난수 상태를 거부한다", () => {
    for (const change of [
      (w: World) => {
        w.relations = [{ a: 999, b: 1, score: 0, war: true, since: 0 }];
      },
      (w: World) => {
        w.settlers = [{ tile: -1, population: 20, progress: 0 }];
      },
      (w: World) => {
        w.nations[0].samples = [null as never];
      },
      (w: World) => {
        w.rng = NaN;
      },
    ]) {
      const w = make();
      change(w);
      expect(validate(w)).toBe(false);
    }
  });
});
