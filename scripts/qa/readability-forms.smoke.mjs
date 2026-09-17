import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/readability-forms';await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]) {
 const t=await setup(engine,width),{page}=t;
 let habit=null,fail=true;const writes=[];
 try {
  await page.evaluate(()=>document.fonts.ready);
  const material=await page.locator('.composer').evaluate(e=>({surface:getComputedStyle(e).backgroundColor,font:getComputedStyle(e.querySelector('textarea')).fontFamily}));
  assert.equal(material.surface,'rgb(250, 249, 252)');assert.match(material.font,/Naris/);
  await page.screenshot({path:`${out}/${engine}-home.png`});
  await page.route('**/api/habits**',async r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{habits:habit?[habit]:[]}});
   const body=r.request().postDataJSON();writes.push(body);
   if(fail)return r.fulfill({status:503,json:{error:'QA_SAVE_FAILURE'}});
   habit={...body,id:'habit-test',status:'active',checkins:[]};return r.fulfill({json:{habit}});
  });
  await t.nav('profile');await page.getByRole('button',{name:/^Привычки/}).click();
  await page.getByRole('button',{name:'Добавить привычку'}).click();
  const form=page.locator('.pso-form');
  await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  assert.equal(writes.length,0,'empty title cannot submit');
  await form.getByLabel('Название',{exact:true}).fill('Вечерняя прогулка');
  await form.getByRole('radio',{name:'Прогулка',exact:true}).check();
  const weekly=form.getByRole('radio',{name:'Каждую неделю',exact:true});
  await weekly.check();await weekly.press('ArrowLeft');assert.equal(await form.getByRole('radio',{name:'Каждый день',exact:true}).isChecked(),true);await weekly.check();
  await form.getByRole('button',{name:'Увеличить количество'}).click();
  assert.equal(await form.getByLabel('Сколько раз',{exact:true}).inputValue(),'2');
  assert.equal(await form.locator('select').count(),0);
  assert.match(await form.getByLabel('Название',{exact:true}).evaluate(e=>getComputedStyle(e).fontFamily),/Naris/);
  await page.screenshot({path:`${out}/${engine}-habit.png`});
  await form.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.getByText('Привычка не сохранилась. Проверь данные и попробуй снова.',{exact:true}).waitFor();
  assert.equal(await form.getByLabel('Название',{exact:true}).inputValue(),'Вечерняя прогулка');
  fail=false;await form.getByRole('button',{name:'Сохранить',exact:true}).click();await form.waitFor({state:'hidden'});
  assert.equal(writes.at(-1).cadence,'weekly');assert.equal(writes.at(-1).targetPerPeriod,2);
  await page.getByRole('button',{name:'Изменить',exact:true}).click();assert.equal(await form.getByLabel('Сколько раз',{exact:true}).inputValue(),'2');
  await form.getByRole('button',{name:'Отмена',exact:true}).click();
  const communityWrites=[];
  await page.route('**/api/map/live**',r=>{
   if(r.request().method()==='GET')return r.fulfill({json:{signals:[],hazards:[]}});
   communityWrites.push(r.request().postDataJSON());return r.fulfill({json:{ok:true}});
  });
  await t.nav('map');await page.getByRole('button',{name:'Мы гуляем',exact:true}).click();
  const panel=page.locator('.map-refresh-panel');
  assert.doesNotMatch(await panel.innerText(),/Фото, имя|Перемещения не передаются/);
  await panel.getByRole('radio',{name:'60 мин',exact:true}).check();
  await panel.getByRole('button',{name:'Поставить отметку',exact:true}).click();await panel.waitFor({state:'hidden'});
  assert.equal(communityWrites[0].minutes,60);assert.equal(communityWrites[0].petId,t.pet.id);
  await page.getByRole('button',{name:'Отметить',exact:true}).click();
  await panel.getByLabel('Что случилось').fill('Стекло');await panel.getByRole('radio',{name:'100 м',exact:true}).check();await panel.getByRole('radio',{name:'24 ч',exact:true}).check();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.map-refresh-panel')).opacity==='1');
  await page.screenshot({path:`${out}/${engine}-hazard.png`});
  await panel.getByRole('button',{name:'Поставить отметку',exact:true}).click();await panel.waitFor({state:'hidden'});
  assert.equal(communityWrites[1].radius,100);assert.equal(communityWrites[1].hours,24);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(t.errors,[]);
  results.push({engine,width,pass:true,scope:'readability/material, habit validation/keyboard/save failure/retry/edit, presence/hazard payloads; fixture APIs, no remote writes'});
 } catch(e) {await page.screenshot({path:`${out}/${engine}-failure.png`});await fs.writeFile(`${out}/failure.txt`,await page.locator('body').innerText());throw e;} finally {await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
