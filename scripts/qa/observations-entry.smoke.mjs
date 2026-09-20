import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/observations-entry';await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320],['chromium',1100]]){
 const t=await setup(engine,width),{page,ctx,state,pet}=t;
 try{
  let releaseRead;let failRead=true;const readGate=new Promise(resolve=>{releaseRead=resolve;});
  await ctx.route('**/api/health?*',async route=>{if(!failRead)return route.fallback();await readGate;return route.fulfill({status:503,json:{error:'QA_READ_FAILURE'}});});
  state.observations=[];await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();
  const open=async()=>{await t.nav('all');await page.locator('[data-tool-destination=health]').click();await page.getByRole('heading',{name:'Наблюдения',exact:true}).waitFor();};
  await open();await page.getByRole('status').filter({hasText:'Загружаю записи'}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Первая заметка'}).count(),0);
  releaseRead();await page.getByRole('alert').filter({hasText:'Не удалось загрузить'}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Первая заметка'}).count(),0);
  failRead=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await page.getByRole('region',{name:'Первая заметка'}).waitFor();
  assert.equal(await page.locator('#history-search').count(),0);assert.equal(await page.locator('#exact-history-date').count(),0);
  const capture=async name=>{await page.waitForFunction(()=>[...document.querySelectorAll('#pso-exact-content img')].filter(img=>img.getClientRects().length).every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#pso-exact-content img')].filter(img=>img.getClientRects().length).map(img=>img.decode()));});await page.screenshot({path:`${out}/${engine}-${width}-${name}.png`});assert.ok(await page.locator('#pso-exact-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'horizontal overflow');};
  await capture('empty');
  await page.getByRole('button',{name:'Добавить наблюдение',exact:true}).click();
  const input=page.locator('#observe-text');assert.equal(await input.inputValue(),'');
  assert.equal(await page.locator('.observation-composer details,.observation-composer select').count(),0);
  assert.equal(await page.locator('.observation-options button').count(),16);
  assert.equal(await page.locator('.observation-options [aria-pressed=true]').count(),0);
  const save=page.getByRole('button',{name:'Сохранить запись',exact:true});assert.equal(await save.isDisabled(),true);
  await capture('editor');
  const note='После прогулки ел с аппетитом';await input.fill(note);
  await page.locator('header button.back').click();
  await page.getByRole('button',{name:'Добавить наблюдение',exact:true}).click();assert.equal(await input.inputValue(),note);
  state.fail=true;await save.click();await page.locator('#exact-observation-error').filter({hasText:'Не удалось'}).waitFor();assert.equal(await input.inputValue(),note);state.fail=false;
  await ctx.route('**/api/observations',async route=>{
   if(route.request().method()!=='POST')return route.fallback();
   const body=route.request().postDataJSON();const row={id:'22222222-2222-4222-8222-222222222222',pet_id:pet.id,note:body.note,value:body.value,type:'note',created_at:new Date().toISOString(),observed_at:body.observedAt,source:'manual'};
   state.observations=[row];await route.fulfill({json:{observation:row,mode:'supabase'}});
  });
  await save.click();await page.getByText('Запись сохранена',{exact:true}).waitFor();
  await page.getByRole('button',{name:'В историю',exact:true}).click();
  await page.locator('#history-search').fill('совсем другое');await page.getByRole('status').filter({hasText:'По этим условиям'}).waitFor();
  await page.getByRole('button',{name:'Сбросить поиск и дату',exact:true}).click();
  await page.getByRole('button').filter({hasText:note}).waitFor();
  await page.getByText('Найти по дате',{exact:true}).click();await page.locator('#exact-history-date').fill('2000-01-01');
  await page.getByRole('status').filter({hasText:'По этим условиям'}).waitFor();
  await page.getByRole('button',{name:'Сбросить поиск и дату',exact:true}).click();
  await capture('list');
  const fonts=await page.locator('.observations-history :is(h1,p,label,summary,button,input)').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent?.slice(0,45),font:getComputedStyle(el).fontFamily})));
  assert.ok(fonts.every(f=>f.font.startsWith('Naris')),JSON.stringify(fonts));
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await open();
  await page.getByRole('button').filter({hasText:note}).click();await page.locator('.note-body').filter({hasText:note}).waitFor();
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,fonts,scenarios:'loading/error not misrepresented as empty, read retry; empty invitation/no filters; no invented draft; open optional one-tap metrics; back preserves draft; error preserves note/retry; saved detail; text/date no-results/reset; reload persistence via API fixture; no overflow'});
 }finally{await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
