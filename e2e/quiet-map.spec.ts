import { test, expect } from "@playwright/test";
test("quiet map display controls and contextual diplomacy remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await expect(page.locator(".kingdom-list button").first()).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "표시", exact: true }).click();
  await expect(page.getByLabel("확대 시 도시 이름")).not.toBeChecked();
  await page.getByLabel("국가 이름 · 문명 시대").uncheck();
  await page.getByLabel("선택 국가의 외교 연결").uncheck();
  await page.getByLabel("국가 이름 · 문명 시대").check();
  await page.getByLabel("선택 국가의 외교 연결").check();
  await page.screenshot({
    path: "test-results/screenshots-0.7/quiet-map-settings.png",
  });
  await page.getByRole("button", { name: "표시", exact: true }).click();
  for (const sort of [
    "alliance",
    "religion",
    "level",
    "territory",
    "population",
  ]) {
    await page.getByLabel("국가 정렬 기준").selectOption(sort);
    await expect(page.locator(".kingdom-list button").first()).toBeVisible();
    if (sort === "alliance" || sort === "religion")
      await expect(page.locator(".nation-group-heading").first()).toBeVisible();
  }
  await page.getByLabel("국가 검색").fill("존재하지않는국가");
  await expect(page.locator(".empty-nations")).toBeVisible();
  await page.getByLabel("국가 검색").fill("");
  await page.locator(".kingdom-list button").first().click();
  await expect(page.locator(".diplomatic-card")).toContainText("문명 시대");
  await expect(page.locator(".diplomatic-card")).toContainText("동맹국");
  await expect(page.locator(".civic-explainer")).toContainText("수도 양식");
  await page.getByText("이전 관측과 비교", { exact: true }).click();
  await page
    .getByRole("button", { name: "이 국가를 비교 기준으로 저장" })
    .click();
  await expect(page.locator(".run-comparison").first()).toContainText("기준:");
  await page.getByLabel("국가 정보 닫기").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "표시", exact: true }).click();
  await expect(page.getByLabel("가벼운 지도")).toBeChecked();
  await expect
    .poll(() =>
      page
        .getByLabel("문명 세계 지도")
        .evaluate((el) =>
          Math.abs(
            (el as HTMLCanvasElement).width - el.getBoundingClientRect().width,
          ),
        ),
    )
    .toBeLessThan(2);

  await page.screenshot({
    path: "test-results/screenshots-0.7/quiet-map-diplomacy.png",
  });
  expect(errors).toEqual([]);
});
