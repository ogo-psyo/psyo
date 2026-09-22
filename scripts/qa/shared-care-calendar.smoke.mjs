import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out='artifacts/shared-care-calendar';await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page,ctx,state,pet}=t;
 try{
  const target=new Date();target.setDate(15);target.setMonth(target.getMonth()-1);target.setHours(12,0,0,0);
  const day=[target.getFullYear(),String(target.getMonth()+1).padStart(2,'0'),'15'].join('-');
  const later=new Date(target);later.setDate(16);
  const entry={id:'33333333-3333-4333-8333-333333333333',petId:pet.id,note:'Давнее наблюдение для календаря',createdAt:target.toISOString(),observedAt:target.toISOString(),type:'note'};
  const entries=[...Array.from({length:34},(_,i)=>({...entry,id:`row-${i}`,note:`Запись следующего дня ${i}`,createdAt:later.toISOString(),observedAt:later.toISOString()})),entry];
  state.observations=entries.slice(0,30);
  let fail=false,delay=false,deleted=false,release;const requests=[];
  await ctx.route('**/api/health?*',async route=>{
   const u=new URL(route.request().url()),from=u.searchParams.get('from'),to=u.searchParams.get('to');
   if(!from)return route.fulfill({json:{entries:entries.slice(0,30),hasMore:true,nextCursor:'legacy-more'}});
   requests.push({from,to,before:u.searchParams.get('before')});
   if(delay){delay=false;await new Promise(resolve=>release=resolve);}
   if(fail)return route.fulfill({status:503,json:{error:'QA_FAILURE'}});
   const rows=entries.filter(e=>(!deleted||e.id!==entry.id)&&Date.parse(e.observedAt)>=Date.parse(from)&&Date.parse(e.observedAt)<Date.parse(to));
   const offset=Number(u.searchParams.get('before')||0),more=offset+30<rows.length;
   return route.fulfill({json:{entries:rows.slice(offset,offset+30),hasMore:more,nextCursor:more?String(offset+30):null}});
  });
  await ctx.route('**/api/reminders?*',route=>route.fulfill({json:{reminders:[{...state.reminders[1],dueAt:target.toISOString(),title:'Груминг в этот день'}],mode:'user'}}));
  await ctx.route(`**/api/observations/${entry.id}`,async route=>{if(route.request().method()==='DELETE'){deleted=true;return route.fulfill({json:{ok:true,deletedAt:new Date().toISOString()}});}const body=route.request().postDataJSON();Object.assign(entry,body);return route.fulfill({json:{observation:entry}});});
  await ctx.route(`**/api/observations/${entry.id}/restore`,route=>{deleted=false;return route.fulfill({json:{observation:entry}});});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();
  await t.nav('all');await page.locator('[data-tool-destination=calendar]').click();
  await page.getByRole('button',{name:'История наблюдений',exact:true}).click();
  await page.locator('[data-care-calendar]').waitFor();
  assert.equal(await page.locator('#exact-history-date').count(),0);
  await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();
  await page.locator(`[data-day="${day}"].has-observation`).waitFor();
  assert.ok(requests.some(r=>r.before==='30'),'old records past first page fetched');
  await page.locator(`[data-day="${day}"] button`).click();
  await page.getByRole('button').filter({hasText:'Груминг в этот день'}).waitFor();
  await page.locator(`[data-observation-id="${entry.id}"]`).waitFor();
  await page.locator(`[data-observation-id="${entry.id}"] button`).click();
  await page.locator('.note-body').filter({hasText:entry.note}).waitFor();
  await page.getByRole('button',{name:'Изменить',exact:true}).click();await page.locator('#observe-text').fill('Уточнение давнего наблюдения');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await page.locator('.note-body').filter({hasText:'Уточнение давнего наблюдения'}).waitFor();
  await page.getByRole('button',{name:'В календарь',exact:true}).click();
  await page.locator(`[data-day="${day}"][data-selected=true]`).waitFor();
  await page.locator(`[data-observation-id="${entry.id}"]`).filter({hasText:'Уточнение давнего наблюдения'}).waitFor();
  await page.getByRole('button',{name:'Наблюдения',exact:true}).click();
  assert.equal(await page.getByRole('button').filter({hasText:'Груминг в этот день'}).count(),0);
  await page.getByRole('button',{name:'Все',exact:true}).click();
  await page.evaluate(()=>document.fonts.ready);await page.locator('#pso-exact-content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/${engine}-calendar.png`});
  await page.locator(`[data-observation-id="${entry.id}"]`).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${engine}-day.png`});
  assert.ok(await page.locator('#pso-exact-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.getByText('Найти запись',{exact:true}).click();await page.locator('#care-history-search').fill('Уточнение давнего');await page.locator(`[data-observation-id="${entry.id}"]`).waitFor();assert.equal(await page.getByRole('button').filter({hasText:'Груминг в этот день'}).count(),0);await page.locator('#care-history-search').fill('');
  await page.locator(`[data-observation-id="${entry.id}"] button`).click();await page.getByRole('button',{name:'Удалить запись',exact:true}).click();await page.getByRole('button',{name:'Убрать запись',exact:true}).click();
  await page.getByText('Наблюдение убрано.',{exact:true}).waitFor();assert.equal(await page.locator(`[data-observation-id="${entry.id}"]`).count(),0);
  await page.getByRole('button',{name:'Вернуть',exact:true}).click();await page.locator(`[data-observation-id="${entry.id}"]`).waitFor();
  fail=true;await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Не удалось загрузить наблюдения'}).waitFor();assert.equal(await page.getByText('На эту дату записей нет.',{exact:true}).count(),0);
  fail=false;await page.getByRole('alert').filter({hasText:'Не удалось загрузить наблюдения'}).getByRole('button',{name:'Повторить'}).click();
  await page.getByRole('alert').filter({hasText:'Не удалось загрузить наблюдения'}).waitFor({state:'hidden'});
  // A stale response from another month must not replace the selected month's data.
  delay=true;await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();await page.getByText('Загружаю наблюдения за месяц…',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();release();
  await page.getByText('Загружаю наблюдения за месяц…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.locator(`[data-observation-id="${entry.id}"]`).count(),0);
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scenarios:'single calendar; range pagination; same-day care+observation; open/edit/back retains day; filters; source failure/retry; month race; narrow layout',requests:requests.length});
 }finally{await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
