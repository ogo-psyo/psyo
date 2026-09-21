import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/care-domains';await fs.mkdir(out,{recursive:true});
const q=v=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'";
function sql(s){return execFileSync('/opt/homebrew/opt/docker/bin/docker',['exec','-i','supabase_db_pso-mvp','psql','-U','postgres','-d','pso_care_domains_20260922','-v','ON_ERROR_STOP=1','-Atq'],{input:s,encoding:'utf8'}).trim();}
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page,ctx,pet,state}=t,owner=randomUUID();let lose=true,loadFail=false;const keys=[];
 sql(`insert into auth.users(id) values(${q(owner)});insert into public.pets(id,owner_id,name) values(${q(pet.id)},${q(owner)},'Care fixture');`);
 const read=()=>JSON.parse(sql(`select coalesce(json_agg(r),'[]') from public.reminders r where pet_id=${q(pet.id)};`));
 const mapped=()=>read().map(r=>({id:r.id,petId:r.pet_id,type:r.type,title:r.title,status:r.status,dueAt:r.due_at,completedAt:r.completed_at,recurrence:r.recurrence,snoozedUntil:r.snoozed_until,...r.metadata}));
 const nav=async()=>{await t.nav('all');await page.locator('[data-tool-destination="calendar"]').click();};
 const heading=s=>page.getByRole('heading',{name:s,exact:true});
 try{
 state.reminders=[];
 await ctx.route('**/api/reminders**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,parts=path.split('/'),id=parts[3],action=parts[4];
  if(req.method()==='GET'){
   if(action==='history')return route.fulfill({json:{history:JSON.parse(sql(`select coalesce(json_agg(e),'[]') from public.reminder_events e where reminder_id=${q(id)} and event_type='completed' and not(payload ? 'undoneAt');`))}});
   if(loadFail)return route.fulfill({status:503,json:{error:'QA_LOAD'}});
   return route.fulfill({json:{reminders:mapped(),mode:'user'}});
  }
  const b=req.postDataJSON(),key=req.headers()['idempotency-key'],fingerprint=createHash('sha256').update(JSON.stringify(b)).digest('hex');let stmt;
  if(req.method()==='POST'&&!id){
   keys.push(key);const details={careDomain:b.careDomain,note:b.note,recurrenceBasis:b.recurrenceBasis,reminderPreference:b.reminderPreference};
   stmt=`select public.care_create_reminder_v3(${q(owner)},${q(key)},${q(fingerprint)},${q(pet.id)},${q(b.type)},${q(b.title)},${q(b.dueAt)},${q(b.recurrence)},'manual',${q(b.timeMode)},${q(JSON.stringify(details))}::jsonb,${q(b.completedAt)});`;
  }else if(req.method()==='PATCH'){
   const details={careDomain:b.careDomain,note:b.note,recurrenceBasis:b.recurrenceBasis,reminderPreference:b.reminderPreference};
   const patch={title:b.title,due_at:b.dueAt,recurrence:b.recurrence,type:b.type,time_mode:b.timeMode,care_details:details};
   stmt=`select public.care_update_reminder_atomic(${q(owner)},${q(key)},${q(fingerprint)},${q(id)},${q(JSON.stringify(patch))}::jsonb);`;
  }else if(action==='complete'||action==='undo-complete')stmt=`select public.${action==='complete'?'care_complete_reminder_atomic':'care_undo_reminder_completion_atomic'}(${q(owner)},${q(key)},${q(fingerprint)},${q(id)},${q(b.completedAt)});`;
  else return route.fallback();
  let receipt;try{receipt=JSON.parse(sql(stmt));}catch(e){return route.fulfill({status:409,json:{error:'SQL_FAILURE',message:String(e).slice(0,150)}});}
  state.reminders=mapped();
  if(lose&&!id){lose=false;return route.abort('connectionreset');}
  return route.fulfill({json:receipt});
 });
 await nav();await heading('Забота').waitFor();await page.getByText('Воспитание',{exact:true}).waitFor();
 await page.locator('.cw-art img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 assert.equal(await page.locator('.cw-art img').count(),5);
 await page.screenshot({path:`${out}/${engine}-overview.png`});
 await page.getByRole('button',{name:'Запланировать',exact:true}).click();
 await page.getByLabel('Что за дело?').fill('Свободное дело QA');await page.getByLabel('Заметка',{exact:true}).fill('Без обязательной категории');
 await page.locator('.cw-form textarea').focus();
 await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>window.__careHeight||innerHeight});window.__careHeight=350;window.visualViewport.dispatchEvent(new Event('resize'));});
 await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');
 await page.waitForFunction(()=>{const r=document.querySelector('.cw-form textarea').getBoundingClientRect();return r.top>=0&&r.bottom<=350;});
 await page.screenshot({path:`${out}/${engine}-keyboard.png`});
 await page.evaluate(()=>{window.__careHeight=innerHeight;window.visualViewport.dispatchEvent(new Event('resize'));});
 await page.getByLabel('Дата',{exact:true}).fill('2026-10-06');
 await page.getByRole('button',{name:'Сохранить дело',exact:true}).click();await page.locator('.cw-form [role=alert]').waitFor();
 assert.equal(await page.getByLabel('Что за дело?').inputValue(),'Свободное дело QA');
 await page.getByRole('button',{name:'Сохранить дело',exact:true}).click();await heading('Свои дела').waitFor();
 assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(read().length,1);assert.equal(read()[0].metadata.careDomain,null);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await nav();
 await heading('Свои дела').waitFor();await page.locator('.cw-event-open').filter({hasText:'Свободное дело QA'}).click();await heading('Свободное дело QA').waitFor();
 await page.getByRole('button',{name:'Перенести',exact:true}).click();await page.getByLabel('Новая дата').fill('2026-10-09');await page.getByRole('button',{name:'Сохранить дату'}).click();await heading('Забота').waitFor();assert.ok(read()[0].due_at.startsWith('2026-10-09'));
 await page.locator('.cw-event-open').filter({hasText:'Свободное дело QA'}).click();await page.getByRole('button',{name:'Изменить',exact:true}).click();await page.getByLabel('Повтор',{exact:true}).selectOption('monthly');await page.getByRole('button',{name:'После выполнения',exact:true}).click();await page.getByRole('button',{name:'Сохранить изменения'}).click();await heading('Забота').waitFor();
 await page.getByRole('button',{name:'Отметить выполненным: Свободное дело QA',exact:true}).click();await page.getByLabel('Когда сделали').fill('2026-09-20');await page.getByRole('button',{name:'Записать выполнение'}).click();await heading('Забота').waitFor();assert.equal(await page.evaluate(v=>{const d=new Date(v);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');},read()[0].due_at),'2026-10-20');
 await page.locator('.cw-event-open').filter({hasText:'Сделано'}).click();await page.getByRole('button',{name:'Отменить отметку выполнения'}).click();await heading('Забота').waitFor();assert.ok(read()[0].due_at.startsWith('2026-10-09'));
 await page.getByRole('button',{name:'Уже сделали',exact:true}).click();await page.getByLabel('Что за дело?').fill('Прошлое событие QA');await page.getByLabel('Когда сделали').fill('2026-09-18');await page.getByRole('button',{name:'Сохранить в историю'}).click();await heading('Забота').waitFor();assert.equal(read().find(r=>r.title==='Прошлое событие QA').status,'done');
 await page.getByRole('button',{name:'Календарь',exact:true}).click();await page.locator('.cw-calendar').waitFor();await page.screenshot({path:`${out}/${engine}-calendar.png`});
 assert.ok(await page.locator('.cw-calendar button').count()>28);
 await page.locator('.cw-calendar [data-day="2026-09-18"] button').click();
 await page.locator('.cw-event-open').filter({hasText:'Прошлое событие QA'}).waitFor();
 await page.getByRole('button',{name:'Запланировать',exact:true}).click();assert.equal(await page.getByLabel('Дата',{exact:true}).inputValue(),'2026-09-18');
 await page.locator('.cw-form').getByRole('button',{name:'Назад',exact:true}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 loadFail=true;await t.nav('today');await nav();await page.getByText('Не удалось загрузить дела.',{exact:false}).waitFor();loadFail=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await heading('Забота').waitFor();
 assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,storage:'isolated real PostgreSQL; auth and API transport adapter',scenarios:'art, free create, lost reply/retry one row, reload, edit metadata, reschedule, actual recurrence, undo, historical fact, calendar, read error/retry, overflow'});
 }catch(e){await page.screenshot({path:`${out}/${engine}-failure.png`});throw e;}
 finally{await t.browser.close();sql(`delete from auth.users where id=${q(owner)};`);}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
