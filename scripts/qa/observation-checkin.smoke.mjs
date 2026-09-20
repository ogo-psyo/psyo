import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/observation-checkin';await fs.mkdir(out,{recursive:true});const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page,ctx,state,pet}=t;let writes=[];let release;const gate=new Promise(resolve=>{release=resolve;});
 try{
  state.observations[0].mood='настороженное';await page.reload();await page.locator('.app-tabs').waitFor();
  await t.nav('all');await page.locator('[data-tool-destination=health]').click();await page.getByRole('button',{name:'Добавить наблюдение',exact:true}).click();
  const group=name=>page.getByRole('group',{name,exact:true});const mood=group('Настроение');const save=page.getByRole('button',{name:'Сохранить запись',exact:true});
  assert.equal(await page.locator('.observation-composer select,.observation-composer details').count(),0);
  assert.equal(await page.locator('.observation-options [aria-pressed=true]').count(),0);assert.equal(await save.isDisabled(),true);
  await mood.getByRole('button',{name:'Спокойно',exact:true}).click();await mood.getByRole('button',{name:'Радостно',exact:true}).click();assert.equal(await mood.locator('[aria-pressed=true]').count(),1);await mood.getByRole('button',{name:'Радостно',exact:true}).click();assert.equal(await save.isDisabled(),true);
  await mood.getByRole('button',{name:'Тревожно',exact:true}).focus();await page.keyboard.press('Space');assert.equal(await mood.getByRole('button',{name:'Тревожно'}).getAttribute('aria-pressed'),'true');
  await group('Аппетит').getByRole('button',{name:'Не ест',exact:true}).click();await group('Стул').getByRole('button',{name:'Мягкий',exact:true}).click();await group('Энергия').getByRole('button',{name:'Меньше',exact:true}).click();
  const dimensions=await page.locator('.observation-options button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,overflow:n.scrollWidth>n.clientWidth+1};}));assert.ok(dimensions.every(r=>r.width>=44&&r.height>=44&&!r.overflow),JSON.stringify(dimensions));
  state.fail=true;await save.click();await page.locator('#exact-observation-error').filter({hasText:'Не удалось'}).waitFor();assert.equal(await page.locator('.observation-options [aria-pressed=true]').count(),4);state.fail=false;
  await ctx.route('**/api/observations',async route=>{if(route.request().method()!=='POST')return route.fallback();const body=route.request().postDataJSON();writes.push(body);await gate;const row={id:'22222222-2222-4222-8222-222222222222',pet_id:pet.id,type:'mood',value:body.mood,note:body.note,metadata:{mood:body.mood,appetite:body.appetite,stool:body.stool,energy:body.energy},created_at:body.observedAt,observed_at:body.observedAt,source:'manual'};state.observations.push(row);await route.fulfill({json:{observation:row,mode:'supabase'}});});
  await save.click();await page.getByRole('button',{name:'Сохраняю…',exact:true}).waitFor();assert.equal(await mood.getByRole('button',{name:'Спокойно'}).isDisabled(),true);release();await page.getByText('Запись сохранена',{exact:true}).waitFor();
  assert.equal(writes.length,1);assert.equal(writes[0].note,null);assert.deepEqual([writes[0].mood,writes[0].appetite,writes[0].stool,writes[0].energy],['тревожное','не ела','мягкий','ниже обычного']);
  await page.getByText('Аппетит: не ела',{exact:true}).waitFor();
  await page.getByRole('button',{name:'В историю',exact:true}).click();await page.getByRole('button').filter({hasText:'Контрольная запись для открытия'}).click();await page.getByRole('button',{name:'Изменить',exact:true}).click();
  assert.equal(await group('Настроение').getByRole('button',{name:'настороженное',exact:true}).getAttribute('aria-pressed'),'true');
  await group('Аппетит').getByRole('button',{name:'Больше',exact:true}).click();await page.locator('#observe-text').fill('Дополнение к старой записи');
  let edited;
  await ctx.route('**/api/observations/o1',async route=>{const body=route.request().postDataJSON();edited=body;const row={...state.observations[0],...body};state.observations[0]=row;await route.fulfill({json:{observation:row}});});
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.locator('.note-body').filter({hasText:'Дополнение к старой записи'}).waitFor();assert.equal(edited.mood,'настороженное');assert.equal(edited.appetite,'выше обычного');
  await page.getByRole('button',{name:'Изменить',exact:true}).click();await group('Настроение').getByRole('button',{name:'настороженное',exact:true}).click();assert.equal(await group('Настроение').locator('[aria-pressed=true]').count(),0);
  await page.locator('#observe-text').focus();await page.setViewportSize({width,height:350});await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');
  const editSave=page.getByRole('button',{name:'Сохранить изменения',exact:true});await editSave.scrollIntoViewIfNeeded();const rect=await editSave.boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=350);await page.screenshot({path:`${out}/${engine}-keyboard.png`});
  await page.setViewportSize({width,height:844});await page.locator('.nav-wrap').waitFor({state:'visible'});
  await page.locator('#pso-exact-content').evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:`${out}/${engine}-selected.png`});assert.deepEqual(t.errors,[]);
  results.push({engine,width,pass:true,scenarios:'16 visible choices/no defaults; select/replace/clear; keyboard Space; 44px targets; metrics-only failure/retry/busy lock/canonical payload; legacy custom preserved and clearable; mixed edit; keyboard save visible'});
 }finally{release();await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
