import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const b=await chromium.launch();const all=[];const base='http://localhost:3214/?demo=1';
const cases={
 onboarding:async p=>{await p.route('**/api/app/bootstrap**',r=>r.fulfill({json:{mode:'supabase',connected:true,empty:true,user:null,pets:[]}}));await p.evaluate(()=>localStorage.clear());await p.goto('http://localhost:3214/',{waitUntil:'networkidle'});await p.getByRole('button',{name:'Добавить собаку',exact:true}).first().click();},
 support:async p=>p.goto('http://localhost:3214/support'),
 privacy:async p=>p.goto('http://localhost:3214/legal/privacy'),
 public:async p=>p.goto('http://localhost:3214/dog/card?demo=1&name=Плутон'),
 calendar:async p=>p.getByRole('button',{name:'Открыть план ухода',exact:true}).first().click(),
 health:async p=>p.locator('.journal-status-history').click(),
 settings:async p=>{await profile(p);await p.getByRole('button',{name:'Настройки и приватность'}).click()},
 card:async p=>{await profile(p);await p.getByRole('button',{name:/Памятка для близких/}).click()},
 things:async p=>{await nav(p,'things');await p.getByRole('button',{name:'Добавить в список',exact:true}).click()},
 passport:async p=>{await profile(p);await p.getByRole('button',{name:/Паспорт и привычки/}).click()},
 character:async p=>{await cases.passport(p);await p.getByRole('button',{name:'Характер',exact:true}).click()},
 social:async p=>{await cases.passport(p);await p.getByRole('button',{name:'С окружающими',exact:true}).click()},
 habits:async p=>{await cases.passport(p);await p.getByRole('button',{name:'Повторяемые привычки',exact:true}).click()},
 history:async p=>{await profile(p);await p.getByRole('button',{name:/Здоровье и документы/}).click()},
 editor:async p=>{await profile(p);await p.getByRole('button',{name:'Изменить данные',exact:true}).click()},
 identity:async p=>{await profile(p);await p.locator('.journal-portrait').click()},
 capture:async p=>{await profile(p);await p.getByRole('button',{name:'Добавить запись',exact:true}).click()},
 gav:async p=>{await nav(p,'nearby');await p.getByRole('button',{name:/Дать Гав/}).first().click()},
 gav_profile:async p=>{await nav(p,'nearby');await p.getByRole('button',{name:'Знакомства',exact:true}).click();await p.getByRole('button',{name:'Создать анкету',exact:true}).first().click()},
 gav_requests:async p=>{await nav(p,'nearby');await p.getByRole('button',{name:/Отклики и связи/}).click()},
 assistant:async p=>{await p.locator('.journal-ask').click()},
};
async function nav(p,x){await p.locator(`.app-tabs [data-route="${x}"]`).click()};async function profile(p){await nav(p,'profile')}
for(const width of [320,390])for(const [name,go] of Object.entries(cases)){
 const p=await b.newPage({viewport:{width,height:844}});await p.route('https://telegram.org/**',r=>r.abort());await p.goto(base,{waitUntil:'networkidle'});await p.locator('[data-production-journey="today"]').waitFor();
 try{await go(p);await p.waitForTimeout(200);await p.screenshot({path:`artifacts/design-v6-all/${name}-${width}.png`});all.push(await p.evaluate(({name,width})=>({name,width,overflow:document.documentElement.scrollWidth>innerWidth}),{name,width}));}catch(e){all.push({name,width,error:String(e).slice(0,180)});}
 await p.close();
}
await fs.writeFile('artifacts/design-v6-all/geometry.json',JSON.stringify(all,null,2));console.log(JSON.stringify(all));await b.close();
