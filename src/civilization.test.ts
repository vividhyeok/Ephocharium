import { describe, it, expect } from "vitest";
import { generate, found, step, apply, validate, type World } from "./engine";
import { prepareLife, refreshLife, eraOf, findRoute } from "./civilization";
function world() {
  const w = generate({
    seed: 71,
    size: 32,
    sea: 0.4,
    forest: 0.3,
    mountains: 0.03,
    preset: "empty",
  });
  for (const t of w.tiles) {
    t.t = 2;
    t.fertility = 0.9;
    t.damage = 0;
    t.wood = 0;
    t.mineral = 0;
    t.ore = 0.5;
  }
  const a = found(w, 10 * w.width + 8, 500)!,
    b = found(w, 10 * w.width + 24, 500)!;
  for (let i = 0; i < w.tiles.length; i++)
    w.tiles[i].owner = i % w.width < 16 ? a.id : b.id;
  for (const n of w.nations) {
    n.food = 3000;
    n.wealth = 1500;
    n.aggression = 0.2;
  }
  prepareLife(w);
  refreshLife(w);
  return w;
}
function run(w: World, n: number) {
  for (let i = 0; i < n; i++) step(w);
}
describe("움직이는 문명과 발전", () => {
  it("주민은 인구에서 생성되고 유효한 경로를 따라 실제 좌표를 바꾼다", () => {
    const w = world(),
      before = w.life!.citizens.map((c) => ({ ...c }));
    run(w, 12);
    expect(
      w.life!.citizens.some((c) => {
        const old = before.find((a) => a.id === c.id);
        return old && Math.hypot(c.x - old.x, c.y - old.y) > 0.3;
      }),
    ).toBe(true);
    expect(
      w.life!.citizens.every(
        (c) =>
          w.tiles[Math.floor(c.y) * w.width + Math.floor(c.x)].owner ===
          c.nation,
      ),
    ).toBe(true);
    const count = w.life!.citizens.length;
    apply(w, "population", w.nations[0].capital);
    refreshLife(w);
    expect(w.life!.citizens.length).toBeGreaterThan(count);
  });
  it("길찾기는 바다와 산, 타국의 영토를 통과하지 않는다", () => {
    const w = world(),
      start = w.nations[0].capital,
      end = start + 3;
    w.tiles[start + 1].t = 0;
    const route = findRoute(w, start, end, 1);
    expect(route.length).toBeGreaterThan(3);
    expect(route).not.toContain(start + 1);
    expect(findRoute(w, start, w.nations[1].capital, 1)).toEqual([]);
  });
  it("벌목과 채굴은 유한한 현장 자원을 줄이고 비축량을 늘린다", () => {
    const w = world(),
      s = w.life!;
    const tile = w.nations[0].capital + 2;
    w.tiles[tile].t = 3;
    w.tiles[tile].wood = 80;
    w.tiles[tile].mineral = 80;
    const wood = s.citizens.find(
        (c) => c.nation === 1 && c.role === "woodcutter",
      )!,
      miner = s.citizens.find((c) => c.nation === 1 && c.role === "miner")!;
    for (const u of [wood, miner]) {
      u.x = (tile % w.width) + 0.5;
      u.y = Math.floor(tile / w.width) + 0.5;
      u.goal = tile;
      u.route = [];
      u.work = 3;
      u.returning = false;
    }
    const control = structuredClone(w);
    for (const c of control.life!.citizens)
      if (c.id === wood.id || c.id === miner.id) c.role = "resident";
    step(control);
    const stock = control.life!.polities[0].wood,
      metal = control.life!.polities[0].metal;
    step(w);
    expect(w.tiles[tile].wood).toBeLessThan(80);
    expect(w.tiles[tile].mineral).toBeLessThan(80);
    expect(s.polities[0].wood).toBeGreaterThan(stock);
    expect(s.polities[0].metal).toBeGreaterThan(metal);
  });
  it("시대는 연도가 아니라 기술 상태에 따라 바뀌고 건축·공항·비행이 연결된다", () => {
    const w = world();
    w.nations[0].tech = 7.6;
    w.nations[0].population = 1000;
    w.nations[0].wealth = 10000;
    run(w, 75);
    expect(eraOf(w.nations[0])).toBe(5);
    expect(
      w.life!.settlements.filter((c) => c.nation === 1 && c.airport).length,
    ).toBeGreaterThanOrEqual(2);
    expect(w.life!.flights.some((f) => f.nation === 1)).toBe(true);
    const flight = { ...w.life!.flights.find((f) => f.nation === 1)! };
    step(w);
    expect(w.life!.flights.find((f) => f.id === flight.id)!.progress).not.toBe(
      flight.progress,
    );
    expect(w.history.some((e) => e.text.includes("첫 항공로"))).toBe(true);
    expect(
      w.life!.settlements.some((c) => c.nation === 1 && c.level >= 3),
    ).toBe(true);
  });
  it("전쟁은 행군과 전투 후 점령으로 이어지고 평화는 부대를 해산한다", () => {
    const w = world();
    for (const n of w.nations) n.tech = 2;
    apply(w, "war", w.nations[0].capital);
    step(w);
    expect(w.life!.armies.length).toBe(2);
    expect(w.life!.armies.some((a) => a.route.length > 0)).toBe(true);
    expect(w.history.some((e) => e.text.includes("점령"))).toBe(false);
    run(w, 12);
    expect(w.history.some((e) => e.text.includes("점령"))).toBe(true);
    expect(w.tiles.some((t) => t.damage > 0)).toBe(true);
    apply(w, "peace", w.nations[0].capital);
    step(w);
    expect(w.life!.armies).toHaveLength(0);
  });
  it("불안정한 국가에는 권력 공백이 생기고 지도자 표지가 사라진다", () => {
    const w = world();
    w.nations[0].stability = 0.03;
    w.nations[0].population = 50;
    step(w);
    expect(w.life!.polities.find((p) => p.nation === 1)!.regime).toBe("vacuum");
    expect(
      w.life!.citizens.some((c) => c.nation === 1 && c.role === "ruler"),
    ).toBe(false);
  });
  it("기존 저장 세계를 보존하면서 주민과 자원 상태를 초기화한다", () => {
    const w = world();
    delete w.life;
    for (const t of w.tiles) {
      delete t.wood;
      delete t.mineral;
      delete t.road;
    }
    const pop = w.nations.map((n) => n.population),
      history = structuredClone(w.history),
      rng = w.rng;
    expect(validate(w)).toBe(true);
    refreshLife(w);
    expect(w.life!.citizens.length).toBeGreaterThan(0);
    expect(w.nations.map((n) => n.population)).toEqual(pop);
    expect(w.history).toEqual(history);
    expect(w.rng).toBe(rng);
    expect(validate(w)).toBe(true);
  });
  it("경로·정착지·항공·난수 상태를 저장하면 이후 결과까지 재현된다", () => {
    const w = world();
    w.nations[0].tech = 8;
    run(w, 40);
    const copy = JSON.parse(JSON.stringify(w));
    expect(validate(copy)).toBe(true);
    run(w, 30);
    run(copy, 30);
    expect(copy).toEqual(w);
    copy.life.citizens[0].route = [999999];
    expect(validate(copy)).toBe(false);
  });
});
