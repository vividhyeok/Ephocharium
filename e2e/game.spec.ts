import { test, expect } from "@playwright/test";
import { generate, step } from "../src/engine";
test("세계 → 시간 → 저장 → 내보내기 → 복원 → 관찰 모드", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const year = await page.locator(".year").innerText();
  await page.waitForTimeout(1100);
  expect(await page.locator(".year").innerText()).toBe(year);
  await page.keyboard.press("3");
  await expect(
    page.getByRole("button", { name: "5×", exact: true }),
  ).toHaveClass("selected");
  await page.getByRole("button", { name: "▣ 저장" }).click();
  await page
    .getByRole("button", { name: "＋ 저장 슬롯 1에 현재 세계 저장" })
    .click();
  await expect(
    page.locator(".save-row").filter({ hasText: "저장 1" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ 세계 파일 내보내기" }).click();
  expect((await download).suggestedFilename()).toContain("epocharium");
  await page.getByLabel("패널 닫기").click();
  await page.getByRole("button", { name: "＋ 새 세계" }).click();
  await page.getByRole("button", { name: "빈 세계", exact: true }).click();
  await page.getByRole("button", { name: "✦ 새로운 세계 탄생시키기" }).click();
  await expect(page.locator(".stats b").nth(1)).toHaveText("0");
  await page.getByRole("button", { name: "▣ 저장" }).click();
  await page
    .locator(".save-row")
    .filter({ hasText: "저장 1" })
    .getByRole("button", { name: "불러오기" })
    .click();
  await expect(page.locator(".stats b").nth(1)).toHaveText("4");
  await page.getByRole("button", { name: "관찰 모드" }).click();
  await expect(page.locator(".toolbox")).toHaveCount(0);
  await expect(page.getByLabel("사건 따라가기")).toBeVisible();
  await page.getByRole("button", { name: "도구 펼치기" }).click();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "재생", exact: true }),
  ).toBeVisible();
  const pausedYear = await page.locator(".year").innerText();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.getByRole("button", { name: "20×", exact: true }).click();
  await expect
    .poll(async () => page.locator(".year").innerText())
    .not.toBe(pausedYear);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.screenshot({ path: "test-results/desktop.png" });
  expect(errors).toEqual([]);
});
test("작은 화면에서 새 세계 설정과 도구를 사용할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "＋ 새 세계" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("패널 닫기").click();
  await page.getByRole("button", { name: "재해", exact: true }).click();
  await expect(page.getByRole("button", { name: "운석" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/mobile.png" });
});
test("잘못된 세계 파일을 안전하게 거부한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.getByRole("status")).toContainText("올바른 Epocharium");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
});
test("왕국 목록·미니맵·줌 버튼과 패널 키보드 탐색이 동작한다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator(".kingdom-list button").first().click();
  await expect(page.locator(".nation-panel")).toBeVisible();
  await page.getByLabel("국가 정보 닫기").click();
  await page.getByLabel("지도 확대", { exact: true }).click();
  await page.getByLabel("지도 축소", { exact: true }).click();
  await page.getByLabel("세계 전체 보기").click();
  await page.getByLabel("미니맵으로 세계 중앙 이동").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "＋ 새 세계" }).click();
  await expect(page.getByLabel("패널 닫기")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "✦ 새로운 세계 탄생시키기" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("패널 닫기")).toBeFocused();
  await page.screenshot({ path: "test-results/redesign-modal.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("세계 전체 보기").click();
  await page.screenshot({ path: "test-results/redesign-desktop.png" });
});
test("자동 저장 후 새로고침하면 동일한 세계를 이어간다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const year = await page.locator(".year").innerText();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const open = indexedDB.open("epocharium", 1);
              open.onsuccess = () => {
                const db = open.result;
                const request = db
                  .transaction("worlds")
                  .objectStore("worlds")
                  .get("자동 저장");
                request.onsuccess = () => {
                  resolve(!!request.result);
                  db.close();
                };
              };
              open.onerror = () => resolve(false);
            }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  expect(await page.locator(".year").innerText()).toBe(year);
});
test("성장한 세계에서 지도 선택과 신의 개입이 실제 인구를 바꾼다", async ({
  page,
}) => {
  const w = generate({
    seed: 241026,
    size: 112,
    sea: 0.45,
    forest: 0.4,
    mountains: 0.07,
    preset: "four",
  });
  for (let i = 0; i < 250; i++) step(w);
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "world.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect(page.locator(".year")).toContainText("250");
  const box = (await page.getByLabel("문명 세계 지도").boundingBox())!;
  const z = Math.min(
    (box.width - 80) / (w.width * 8),
    (box.height - 80) / (w.height * 8),
  );
  const tile = w.nations[0].capital;
  const x =
      box.x +
      (box.width - w.width * 8 * z) / 2 +
      ((tile % w.width) * 8 + 4) * z,
    y =
      box.y +
      (box.height - w.height * 8 * z) / 2 +
      (Math.floor(tile / w.width) * 8 + 4) * z;
  await page.mouse.click(x, y);
  await expect(page.locator(".nation-panel h2")).toContainText(
    w.nations[0].name,
  );
  const population = Math.round(w.nations[0].population);
  await page.getByRole("button", { name: "인구 지원", exact: true }).click();
  await page.mouse.click(x, y);
  await expect(page.locator(".nation-grid")).toContainText(
    (population + 100).toLocaleString() + "명",
  );
  await page.mouse.wheel(0, -250);
  await page.screenshot({ path: "test-results/developed-world.png" });
  const frame = await page.evaluate(async () => {
    const intervals: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (t: number) => {
        intervals.push(t - last);
        last = t;
        if (intervals.length < 120) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return {
      frames: 120,
      meanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
      p95Ms: intervals.sort((a, b) => a - b)[114],
    };
  });
  console.log("렌더링 측정", JSON.stringify(frame));
});
