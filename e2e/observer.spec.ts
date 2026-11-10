import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("observer is the default and experiments are an explicit reversible mode", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  const welcome = page.getByRole("button", { name: "세계 둘러보기 →" });
  if (await welcome.isVisible()) await welcome.click();
  await expect(
    page.getByRole("navigation", { name: "관찰 도구" }),
  ).toBeVisible();
  await expect(page.locator(".toolbox")).toHaveCount(0);
  await expect(page.getByLabel("개입 실행 취소")).toHaveCount(0);
  await expect(page.locator(".kingdoms-panel")).toBeVisible();
  await page.getByRole("button", { name: "실험 모드", exact: true }).click();
  await expect(page.locator(".toolbox")).toBeVisible();
  await page
    .getByRole("button", { name: "관찰자로 돌아가기", exact: true })
    .click();
  await expect(page.locator(".toolbox")).toHaveCount(0);
  mkdirSync("test-results/observer", { recursive: true });
  await page.screenshot({ path: "test-results/observer/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const nations = page.getByRole("button", { name: "국가 목록", exact: true });
  await expect(nations).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "관찰 도구" })).toHaveCount(
    0,
  );
  await expect(page.locator(".kingdoms-panel")).toHaveCount(0);
  const canvas = page.getByLabel("문명 세계 지도");
  await expect
    .poll(async () => (await canvas.boundingBox())?.height)
    .toBeGreaterThan(700);
  const pause = page.getByRole("button", { name: "일시정지", exact: true });
  await expect(pause).toBeInViewport({ ratio: 1 });
  await pause.click();
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: "test-results/observer/mobile.png" });
  await nations.click();
  await expect(page.getByLabel("국가 검색")).toBeVisible();
  await page.getByLabel("국가 정렬 기준").selectOption("alliance");
  await page.getByLabel("국가 목록 닫기").click();
  await expect(page.locator(".kingdoms-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "연표·전쟁 기록" }).click();
  await expect(page.getByRole("dialog", { name: "세계의 역사" })).toBeVisible();
  await page.getByLabel("패널 닫기").click();

  for (const [width, height] of [
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(nations).toBeInViewport();
    await page.getByRole("button", { name: "세계 전체 보기" }).click();
    const diplomacy = await page.locator(".diplomacy-summary").boundingBox();
    const settings = await page.locator(".map-actions").boundingBox();
    expect(diplomacy!.x + diplomacy!.width).toBeLessThan(settings!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("worker rejects destructive commands while observing and preserves the actual world", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const worker = new Worker("/src/worker.ts", { type: "module" });
    const next = () =>
      new Promise<any>((resolve) =>
        worker.addEventListener("message", (e) => resolve(e.data), {
          once: true,
        }),
      );
    worker.postMessage({ type: "pause", paused: true });
    await next();
    const initial = next();
    worker.postMessage({
      type: "generate",
      options: {
        seed: 42,
        size: 32,
        preset: "four",
        sea: 0.4,
        forest: 0.35,
        mountains: 0.05,
      },
    });
    const first = await initial;
    const target = first.world.nations[0].capital;
    worker.postMessage({
      type: "apply",
      tool: "meteor",
      tile: target,
      radius: 3,
    });
    worker.postMessage({ type: "intervene", a: 1, b: 2, action: "war" });
    await new Promise((r) => setTimeout(r, 150));
    worker.postMessage({ type: "observer", enabled: false });
    worker.postMessage({ type: "begin" });
    const final = next();
    worker.postMessage({ type: "undo" });
    const last = await final;
    worker.terminate();
    return {
      before: JSON.stringify(first.world),
      after: JSON.stringify(last.world),
    };
  });
  expect(result.after).toBe(result.before);
});

test("a fresh world creates people and nations without clicking a tool", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".settler-count")).toBeVisible();
  await expect
    .poll(
      async () => Number(await page.locator(".stats b").nth(1).innerText()),
      { timeout: 12000 },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "＋ 새 세계" }).click();
  await expect(
    page.getByRole("button", { name: "문명의 시작", exact: true }),
  ).toHaveClass("selected");
  await page.getByRole("button", { name: "✦ 새로운 세계 탄생시키기" }).click();
  await expect(page.locator(".settler-count")).toBeVisible();
  await expect
    .poll(
      async () => Number(await page.locator(".stats b").nth(1).innerText()),
      { timeout: 12000 },
    )
    .toBeGreaterThan(0);
});
