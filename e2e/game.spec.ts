import { test, expect } from "@playwright/test";
import { generate, step, found, apply, type World } from "../src/engine";
import { refreshLife } from "../src/civilization";
import { getRelation, treaty } from "../src/diplomacy";
import { readFile } from "node:fs/promises";
test("외교 상태를 가리키거나 키보드로 초점을 옮겨 원인을 읽고 연표를 열 수 있다", async ({
  page,
}) => {
  const w = generate({
    seed: 42,
    size: 192,
    preset: "four",
    sea: 0.4,
    forest: 0.35,
    mountains: 0.05,
  });
  treaty(
    w,
    getRelation(w, 1, 2),
    "alliance",
    "해안 교역로의 공동 보호를 위해 조약을 체결했습니다.",
  );
  treaty(
    w,
    getRelation(w, 3, 4),
    "war",
    "국경 광산의 소유권 분쟁으로 전쟁이 시작되었습니다.",
    3,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "diplomacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  const alliance = page.locator(".diplomacy-status").nth(1).getByRole("button");
  await alliance.focus();
  await expect(page.locator(".diplomacy-preview").nth(1)).toBeVisible();
  await expect(page.locator(".diplomacy-preview").nth(1)).toContainText(
    "해안 교역로",
  );
  await page.locator(".diplomacy-status").first().hover();
  await expect(page.locator(".diplomacy-preview").first()).toContainText(
    "국경 광산",
  );
  await alliance.click();
  await expect(page.locator(".diplomacy-timeline")).toContainText("국경 광산");
  await expect(page.locator(".diplomacy-timeline")).toContainText(
    "해안 교역로",
  );
  await page.screenshot({ path: "test-results/diplomacy-timeline.png" });
});
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
  await page.getByLabel("국가 정보 닫기").click();
  await page.getByRole("button", { name: "인구 지원", exact: true }).click();
  await page.mouse.click(x, y);
  await page.getByRole("button", { name: "관찰", exact: true }).click();
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
test("도시를 확대하면 주민과 항공기를 볼 수 있고 실제 저장 좌표가 진행한다", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const w = generate({
    seed: 71,
    size: 32,
    sea: 0.4,
    forest: 0.3,
    mountains: 0.03,
    preset: "empty",
  });
  for (const t of w.tiles) {
    t.t = 2; t.lake=false; t.river=0;
    t.fertility = 0.9;
    t.ore = 0.8;
    t.wood = 0;
    t.mineral = 100;
  }
  found(w, 328, 700);
  found(w, 344, 700);
  for (let i = 0; i < w.tiles.length; i++) {
    w.tiles[i].owner = i % 32 < 16 ? 1 : 2;
    if (i % 11 === 0) {
      w.tiles[i].t = 3;
      w.tiles[i].wood = 90;
    }
  }
  for (const n of w.nations) {
    n.tech = 91;
    n.food = 5000;
    n.wealth = 5000;
    n.aggression = 0.2;
  }
  refreshLife(w);
  for (let i = 0; i < 180; i++) { for(const c of w.life!.settlements) if(c.urban) c.urban.stock.oil=100; step(w); }
  expect(w.life!.flights.length).toBeGreaterThan(0);
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "future.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect(page.locator(".year")).toContainText("180");
  await page
    .locator(".kingdom-list button")
    .filter({ hasText: w.nations[0].name })
    .click();
  await expect(page.locator(".era-label")).toHaveText("정보 문명");
  await page.locator(".illustrated-nation details").evaluate(el=>(el as HTMLDetailsElement).open=true);
  await page.getByRole("button", { name: "도시 가까이 보기" }).click();
  await expect(page.locator(".city-activity")).toContainText("항공기 1대");
  await page.screenshot({ path: "test-results/aviation-city.png" });
  const snapshot = async (): Promise<World> => {
    await page.getByRole("button", { name: "▣ 저장" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "↓ 세계 파일 내보내기" }).click();
    const d = await pending;
    const value = JSON.parse(await readFile((await d.path())!, "utf8"));
    await page.getByLabel("패널 닫기").click();
    return value;
  };
  const before = await snapshot();
  await page.getByRole("button", { name: "5×", exact: true }).click();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect
    .poll(async () =>
      Number((await page.locator(".year").innerText()).replace(/[^0-9]/g, "")),
    )
    .toBeGreaterThan(before.year + 1);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const after = await snapshot();
  expect(
    after.life!.citizens.some((c) => {
      const previous = before.life!.citizens.find((u) => u.id === c.id);
      return previous && Math.hypot(c.x - previous.x, c.y - previous.y) > 0.1;
    }),
  ).toBe(true);
  expect(after.life!.flights[0].progress).not.toBe(
    before.life!.flights[0].progress,
  );
  expect(errors).toEqual([]);
});

test("전선에서 군대를 확인하고 평화 능력으로 즉시 해산시킬 수 있다", async ({
  page,
}) => {
  const w = generate({
    seed: 71,
    size: 32,
    sea: 0.4,
    forest: 0.3,
    mountains: 0.03,
    preset: "empty",
  });
  for (const t of w.tiles) {
    t.t = 2; t.lake=false; t.river=0;
    t.fertility = 0.9;
    t.wood = 0;
    t.mineral = 0;
    t.ore = 0.5;
  }
  found(w, 328, 500);
  found(w, 344, 500);
  for (let i = 0; i < w.tiles.length; i++)
    w.tiles[i].owner = i % 32 < 16 ? 1 : 2;
  for (const n of w.nations) {
    n.tech = 2;
    n.food = 3000;
    n.wealth = 1500;
    n.aggression = 0.2;
  }
  apply(w, "war", 328);
  for (let i = 0; i < 12; i++) step(w);
  expect(w.life!.armies.some((a) => a.fighting)).toBe(true);
  await page.goto("/");
  await expect(page.getByLabel("문명 세계 지도")).toBeVisible();
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "battle.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(w)),
  });
  await expect(page.locator(".year")).toContainText("12");
  await page
    .locator(".kingdom-list button")
    .filter({ hasText: w.nations[0].name })
    .click();
  await page.getByRole("button", { name: /전선 가까이 보기/ }).click();
  await page.locator(".nation-panel").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/battle-front.png" });
  await page.getByRole("button", { name: "문명", exact: true }).click();
  await page.getByRole("button", { name: "평화", exact: true }).click();
  await page.getByLabel("개입 대상 국가").selectOption("1");
  await page.getByLabel("개입 상대 국가").selectOption("2");
  await page.getByRole("button", { name: "지정한 두 국가에 적용" }).click();
  await expect(page.locator(".stats b").nth(2)).toHaveText("0");
  await expect(page.locator(".city-activity")).toContainText("군대 0개 부대");
});
