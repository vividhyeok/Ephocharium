import {test,expect} from '@playwright/test';
import {generate,step} from '../src/engine';
import {mkdirSync,writeFileSync} from 'node:fs';
test('release atlas, visual action vocabulary, touch pan/pinch and responsive nation sheets',async({page})=>{
 test.setTimeout(90000);mkdirSync('docs/screenshots-0.6',{recursive:true});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const w=generate({seed:42,size:80,preset:'four',sea:.4,forest:.35,mountains:.05});
 for(let i=0;i<1000;i++)step(w);
 await page.goto('/');await page.getByRole('button',{name:'세계 둘러보기 →'}).click();await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'observed-world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(w))});
 await expect(page.locator('.year')).toContainText('1,000');
 await page.screenshot({path:'docs/screenshots-0.6/desktop-observed.png'});
 await page.getByRole('button',{name:'재해',exact:true}).click();
 const sources=await page.locator('.tools img').evaluateAll(images=>images.map(img=>(img as HTMLImageElement).src));expect(new Set(sources).size).toBe(sources.length);
 expect(await page.locator('.tools img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 await page.screenshot({path:'docs/screenshots-0.6/tools-disasters.png'});
 await page.locator('.kingdom-list button').first().click();
 await expect(page.locator('.nation-skyline img')).toBeVisible();await page.screenshot({path:'docs/screenshots-0.6/nation-overview.png'});
 await page.locator('.nation-panel').evaluate(el=>{el.scrollTop=el.scrollHeight/2});await page.screenshot({path:'docs/screenshots-0.6/nation-resources.png'});
 await page.getByLabel('국가 정보 닫기').click();
 for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768]]){
  await page.setViewportSize({width,height});await page.getByLabel('세계 전체 보기').click({timeout:5000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`docs/screenshots-0.6/viewport-${width}-${height}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 const canvas=page.getByLabel('문명 세계 지도');const before=Number(await canvas.getAttribute('data-zoom'));
 const client=await page.context().newCDPSession(page);
 const bounds=(await canvas.boundingBox())!;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:bounds.y+260},{x:230,y:bounds.y+260}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:bounds.y+260},{x:280,y:bounds.y+260}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(before*1.5);
 await page.screenshot({path:'docs/screenshots-0.6/touch-zoom.png'});
 await page.getByRole('button',{name:'재생',exact:true}).click();await page.getByRole('button',{name:'20×',exact:true}).click();
 const frames=await page.evaluate(()=>new Promise<number[]>(resolve=>{let last=performance.now();const values:number[]=[];function next(now:number){values.push(now-last);last=now;if(values.length>=120)resolve(values.slice(1));else requestAnimationFrame(next);}requestAnimationFrame(next);}));
 frames.sort((a,b)=>a-b);writeFileSync('docs/render-performance-0.6.json',JSON.stringify({viewport:'390x844',worldYear:1000,frames:frames.length,meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,p95Ms:frames[Math.floor(frames.length*.95)]},null,2));
 expect(errors).toEqual([]);
});

