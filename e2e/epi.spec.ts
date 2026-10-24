import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("Epi uses bounded real observations for 23 turns, links nations, survives errors, stops and isolates worlds", async ({
  page,
}) => {
  test.setTimeout(90000);
  mkdirSync("docs/screenshots-0.6", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests: any[] = [];
  let mode = "ok";
  await page.route("**/api/epi", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { enabled: true, configured: true } });
      return;
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    if (mode === "auth") {
      await route.fulfill({ status: 401, json: { error: "access_required" } });
      return;
    }
    if (mode === "slow") {
      await new Promise((r) => setTimeout(r, 1500));
      await route
        .fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: 'data: {"type":"done"}\n\n',
        })
        .catch(() => {});
      return;
    }
    const top = body.context.rankings.power[0];
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "meta", year: body.context.year },
        {
          type: "delta",
          text: `창조주님, [${top.name}](nation:${top.id})의 관측 인구는 ${body.context.nations.find((n: any) => n.id === top.id).population}명이에요.`,
        },
        { type: "done" },
      ]
        .map((e) => "data: " + JSON.stringify(e) + "\n\n")
        .join(""),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "세계 둘러보기 →" }).click();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "에피", exact: true }).click();
  for (let i = 0; i < 23; i++) {
    await page
      .getByLabel("에피에게 질문")
      .fill("지금 가장 강한 국가가 어디야? " + i);
    await page.getByRole("button", { name: "전송", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "전송", exact: true }),
    ).toBeVisible();
  }
  expect(requests.length).toBe(23);
  expect(requests.at(-1).messages.length).toBeLessThanOrEqual(16);
  expect(requests.at(-1).summary.length).toBeGreaterThan(0);
  expect(requests.every((r) => JSON.stringify(r).length < 96000)).toBe(true);
  expect(JSON.stringify(requests[0])).not.toContain("tiles");
  await page.locator(".epi-nation").last().click();
  await expect(page.locator(".nation-panel")).toBeAttached();
  await page.screenshot({ path: "docs/screenshots-0.6/epi-desktop.png" });
  await page.getByRole("button", { name: "에피 닫기" }).click();
  await page.getByRole("button", { name: "에피", exact: true }).click();
  await expect(page.locator(".epi-message")).toHaveCount(40);
  mode = "auth";
  await page.getByLabel("에피에게 질문").fill("왕의 성향은?");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect(page.locator(".epi-error").last()).toContainText("초대 코드");
  mode = "slow";
  await page.getByLabel("에피에게 질문").fill("최근 사건");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await page.getByRole("button", { name: "중단", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "전송", exact: true }),
  ).toBeVisible();
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByLabel("에피에게 질문")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots-0.6/epi-${width}-${height}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "에피 닫기" }).click();
  await page.getByRole("button", { name: "＋ 새 세계", exact: true }).click();
  await page.getByRole("button", { name: "✦ 새로운 세계 탄생시키기", exact: true }).click();
  await expect(page.locator(".year")).toContainText("0");
  await page.getByRole("button", { name: "에피", exact: true }).click();
  await expect(page.locator(".epi-message")).toHaveCount(0);
  expect(errors).toEqual([]);
});


test('quiet reports use local events, obey cooldown and can be disabled without AI calls',async({page})=>{
 const {generate,record}=await import('../src/engine');
 const w=generate({seed:42,size:48,preset:'four',sea:.4,forest:.35,mountains:.05});w.worldId='report-fixture';let calls=0;
 await page.route('**/api/epi',async route=>{if(route.request().method()==='POST')calls++;await route.fulfill({json:{enabled:false,configured:false}});});
 await page.goto('/');await page.getByRole('button',{name:'세계 둘러보기 →'}).click();await page.getByRole('button',{name:'일시정지',exact:true}).click();
 const load=async()=>{await page.locator('input[type=file]').setInputFiles({name:'report-world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(w))});};
 await load();await expect(page.locator('.year')).toContainText('0');
 w.year=101;w.nations[0].tech=26;w.life!.polities[0].era=7;record(w,'첫 산업 문명 진입',[1],w.nations[0].capital);await load();
 await expect(page.locator('.epi-report')).toContainText('산업 문명');await page.locator('.epi-report>button').first().click();await expect(page.locator('.epi-panel')).toBeVisible();expect(calls).toBe(0);
 await page.getByRole('button',{name:'에피 닫기'}).click();w.year=102;record(w,'대규모 전쟁 발발',[1,2],w.nations[0].capital);await load();await expect(page.locator('.epi-report')).toHaveCount(0);
 await page.getByRole('button',{name:'표시',exact:true}).click();await page.getByLabel('에피의 조용한 사건 보고').uncheck();expect(calls).toBe(0);
});

test('browser observations pass the real server schema, readonly tool cycle and streamed response',async({page})=>{
 const {handleEpi}=await import('../server/epi');const code='browser-test-invite-0123456789';let upstream=0;
 await page.route('**/api/epi',async route=>{
  const body=route.request().method()==='POST'?route.request().postData():undefined;
  const request=new Request('http://localhost:5173/api/epi',{method:route.request().method(),headers:route.request().headers(),body});
  const mock=(async(_url:any,init:any)=>{upstream++;const payload=JSON.parse(init.body);expect(payload.thinking.type).toBe('disabled');const year=JSON.parse(body!).context.year;
   const chunk=upstream===1?{choices:[{delta:{tool_calls:[{index:0,id:'world',function:{name:'getWorldOverview',arguments:'{}'}}]},finish_reason:'tool_calls'}]}:{choices:[{delta:{content:`창조주님, ${year}년의 관측 자료를 확인했어요.`},finish_reason:'stop'}]};
   return new Response('data: '+JSON.stringify(chunk)+'\n\ndata: [DONE]\n\n');}) as typeof fetch;
  const response=await handleEpi(request,{EPI_ENABLED:'true',DEEPSEEK_API_KEY:'mock-key-not-real',EPI_ACCESS_TOKEN:code},mock);
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 });
 await page.goto('/');await page.getByRole('button',{name:'세계 둘러보기 →'}).click();await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.getByRole('button',{name:'에피',exact:true}).click();
 await page.locator('.epi-access summary').click();await page.getByLabel('초대 코드').fill(code);
 await page.getByLabel('에피에게 질문').fill('현재 세계 인구는?');await page.getByRole('button',{name:'전송',exact:true}).click();await expect(page.locator('.epi-message.assistant').last()).toContainText('관측 자료를 확인');expect(upstream).toBe(2);
});
