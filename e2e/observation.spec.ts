import { test, expect } from "@playwright/test";
import { generate, found, step } from "../src/engine";
import { refreshLife } from "../src/civilization";
import { ERAS } from "../src/eras";
import { readFile } from "node:fs/promises";

test("장기 관측의 시대별 요약과 과거 영토 비교 지도를 펼쳐 볼 수 있다", async ({
  page,
}) => {
  const w = generate({
    seed: 42,
    size: 80,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
  for (let i = 0; i < 200; i++) step(w);
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "history.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(w)),
    });
  await page.getByRole("button", { name: "역사", exact: true }).click();
  await page.getByText("시대별 문명 변화 요약", { exact: true }).click();
  await expect(page.locator(".history-overview")).toContainText("첫 관측");
  await page.getByText("과거와 현재의 영토 비교", { exact: true }).click();
  await page.getByLabel("비교 시점").selectOption("0");
  await expect(
    page.getByLabel("과거와 현재 영토 변화 비교 지도"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/historical-territory.png" });
});

test("지형 브러시 한 번의 드래그를 통째로 취소하고 세계 파일까지 동일하게 복원한다", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const snapshot = async () => {
    await page.getByRole("button", { name: "▣ 저장" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "↓ 세계 파일 내보내기" }).click();
    const file = await pending;
    const result = JSON.parse(await readFile((await file.path())!, "utf8"));
    await page.getByLabel("패널 닫기").click();
    return result;
  };
  const before = await snapshot();
  await page.getByRole("button", { name: "지형", exact: true }).click();
  await page.getByRole("button", { name: "산맥", exact: true }).click();
  const box = (await page.getByLabel("문명 세계 지도").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.screenshot({ path: "test-results/brush-preview.png" });
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const after = await snapshot();
  expect(after.tiles).not.toEqual(before.tiles);
  await page.getByRole("button", { name: "개입 실행 취소" }).click();
  expect(await snapshot()).toEqual(before);
});

test("구버전 항공 문명을 정보 문명으로 옮기고 과거 기록을 보존해 요약한다", async ({
  page,
}) => {
  const w = generate({
    seed: 42,
    size: 80,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
  delete w.progressRevision;
  delete w.chronicle;
  delete w.historySequence;
  for (const e of w.history) {
    delete e.id;
    delete e.importance;
  }
  for (const n of w.nations) {
    n.tech = 7.5;
    delete n.tendencies;
    delete n.eraHistory;
  }
  w.year = 18000;
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect(page.locator(".year")).toContainText("18,000");
  await page.locator(".kingdom-list button").first().click();
  await expect(page.locator(".era-label")).toHaveText("정보 문명");
  await page.getByRole("button", { name: "역사", exact: true }).click();
  await expect(page.locator(".history-summaries")).toContainText("건국 4");
});
test("20배속 연도 진행·지정 외교·한 단계 복원·사건 표시량이 실제로 동작한다", async ({
  page,
}) => {
  const w = generate({
    seed: 42,
    size: 80,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "observe.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await page.getByRole("button", { name: "문명", exact: true }).click();
  await page.getByRole("button", { name: "전쟁", exact: true }).click();
  await page.getByLabel("개입 대상 국가").selectOption("1");
  await page.getByLabel("개입 상대 국가").selectOption("3");
  await page.getByRole("button", { name: "지정한 두 국가에 적용" }).click();
  await expect(page.locator(".diplomacy-summary")).toContainText("전쟁 1");
  await expect(page.locator(".toast")).toContainText("접경이 없어");
  await page.getByRole("button", { name: "개입 실행 취소" }).click();
  await expect(page.locator(".diplomacy-summary")).toContainText("전쟁 0");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "20×", exact: true }).click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const year = +(await page.locator(".year").innerText()).replace(/[^\d]/g, "");
  expect(year).toBeGreaterThanOrEqual(5);
  expect(year).toBeLessThanOrEqual(14);
  await page.getByRole("button", { name: "역사", exact: true }).click();
  await page.getByLabel("사건 표시량").selectOption("off");
  await page.getByLabel("패널 닫기").click();
  await expect(page.locator(".event-feed")).toHaveCount(0);
});
test("14개 시대의 픽셀 건축이 실제 렌더러와 게임 화면에 표시된다", async ({
  page,
}) => {
  const w = generate({
    seed: 4,
    size: 112,
    preset: "empty",
    sea: 0.4,
    forest: 0.2,
    mountains: 0.02,
  });
  for (let i = 0; i < w.tiles.length; i++) {
    const x = i % w.width,
      y = Math.floor(i / w.width);
    w.tiles[i].t = x < 2 || x >= 110 || y < 2 || y >= w.height - 2 ? 0 : 2;
    w.tiles[i].wood = 50;
    w.tiles[i].mineral = 100;
  }
  for (let k = 0; k < 14; k++) {
    const x = 9 + (k % 7) * 15,
      y = 20 + Math.floor(k / 7) * 32;
    const n = found(w, y * w.width + x, 1500 + k * 100)!;
    n.tech = ERAS[k].threshold + 0.01;
    n.food = 100000;
    n.wealth = 100000;
  }
  for (let i = 0; i < w.tiles.length; i++)
    if (w.tiles[i].t !== 0) {
      const x = i % 112,
        y = Math.floor(i / 112);
      w.tiles[i].owner =
        Math.min(6, Math.floor((x - 2) / 15)) + 1 + (y >= 36 ? 7 : 0);
    }
  refreshLife(w);
  for (const c of w.life!.settlements) {
    c.development = 13;
    c.homes = 12;
  }
  for (const p of w.life!.polities) {
    p.metal = 200;
    p.energy = 5;
  }
  step(w);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "eras.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect(page.locator(".stats b").nth(1)).toHaveText("14");
  const unique = await page.evaluate(async () => {
    const module = await import("/src/scene.ts");
    const hashes: string[] = [];
    for (let era = 0; era < 14; era++) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      module.building(ctx, 30, 42, era, "#efb968", 0, true);
      hashes.push(Array.from(ctx.getImageData(0, 0, 64, 64).data).join(","));
    }
    return new Set(hashes).size;
  });
  expect(unique).toBe(14);
  await page.screenshot({ path: "test-results/fourteen-civilizations.png" });
  await page
    .locator(".kingdom-list button")
    .filter({ hasText: w.nations[13].name })
    .click();
  await expect(page.locator(".era-label")).toHaveText("행성간 문명");
  await page.getByRole("button", { name: "도시 가까이 보기" }).click();
  await page.screenshot({ path: "test-results/future-city.png" });
  expect(errors).toEqual([]);
});
