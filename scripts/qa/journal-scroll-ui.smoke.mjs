import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://localhost:3214';const out=process.env.OUT_DIR||'artifacts/scroll-fix';await fs.mkdir(out,{recursive:true});const findings=[];
const routes={
 today:async p=>{await p.locator('.journal-disclosure').first().locator('summary').click();},
 profile:async p=>{await p.locator('.app-tabs [data-route=profile]').click();},
 calendar:async p=>{await p.getByRole('button',{name:'Открыть план ухода',exact:true}).first().click();},
 health:async p=>{await p.locator('.journal-status-history').click();},
 passport:async p=>{await p.locator('.app-tabs [data-route=profile]').click();await p.getByRole('button',{name:/Паспорт и привычки/}).click();},
 things:async p=>{await p.locator('.app-tabs [data-route=things]').click();await p.getByRole('button',{name:'Добавить в список',exact:true}).click();},
 settings:async p=>{await p.locator('.app-tabs [data-route=profile]').click();await p.getByRole('button',{name:'Настройки и приватность'}).click();},
};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{for(const width of [320,390,1280])for(const [name,open] of Object.entries(routes)){
 const height=width===1280?720:width===320?740:844;const p=await browser.newPage({viewport:{width,height},hasTouch:width<760});p.setDefaultTimeout(10000);
 await p.route('https://telegram.org/**',r=>r.abort());await p.route('**/api/app/bootstrap*',r=>r.fulfill({json:{mode:'demo',connected:false,empty:true,pets:[]}}));await p.addInitScript(()=>{window.Telegram={WebApp:{initData:'',ready(){},expand(){},enableClosingConfirmation(){}}};localStorage.setItem('pso.product.profile.v5',JSON.stringify({dogName:'Тестовый Бим',breedId:'mixed',photos:[],backendPetId:'guest-scroll-check',lifeStage:'взрослая'}));localStorage.setItem('pso.topapp.onboarding.v1','done')});
 await p.goto(base,{waitUntil:'networkidle'});await p.locator('.journal-title').waitFor();await open(p);await p.waitForTimeout(150);
 const shell=p.locator('.phone-shell');const box=await shell.boundingBox();await p.mouse.move(box.x+box.width/2,Math.min(height-150,box.y+300));
 await p.mouse.wheel(0,5000);await p.waitForTimeout(250);
 const state=await shell.evaluate(e=>({height:e.clientHeight,content:e.scrollHeight,top:e.scrollTop,overflow:getComputedStyle(e).overflowY}));
 assert.ok(state.height<=height+1,`${name}${width}: scroll container exceeds viewport`);
 assert.equal(state.overflow,'auto',`${engine.name()} ${name}${width}: content shell must accept scrolling`);
 if(state.content>state.height+2)assert.ok(state.top>0,`${engine.name()} ${name}${width}: wheel did not move content`);
 assert.ok(state.top+state.height>=state.content-3,`${engine.name()} ${name}${width}: bottom unreachable ${JSON.stringify(state)}`);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: horizontal overflow`);
 await p.screenshot({path:`${out}/${engine.name()}-${name}-${width}-bottom.png`,animations:'disabled'});
 if(engine===chromium&&width<760&&state.content>state.height+20){
 await p.mouse.wheel(0,-5000);await p.waitForTimeout(200);const before=await shell.evaluate(e=>e.scrollTop);const cdp=await p.context().newCDPSession(p);const x=box.x+box.width/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:height-180}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:height-180-i*40}]});await p.waitForTimeout(20)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);assert.ok(await shell.evaluate(e=>e.scrollTop)>before,`${name}${width}: touch swipe did not scroll`);await cdp.detach();
 }
 findings.push({engine:engine.name(),name,width,...state});await p.close();
 }}finally{await browser.close()}
}
await fs.writeFile(`${out}/scroll.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify({ok:true,cases:findings.length,engines:['chromium','webkit'],input:'wheel both engines; touch swipes Chromium mobile; no programmatic scrolling',limitations:'Emulated browser input, not a physical Telegram client/keyboard'}));
