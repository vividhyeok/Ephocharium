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
  await expect(
    page.getByRole("navigation", { name: "관찰 도구" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/observer/mobile.png" });
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
