import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.OUT_DIR || 'artifacts/motion-b';await fs.mkdir(out,{recursive:true});const results=[];
const base=process.env.BASE_URL || 'http://localhost:3216';
for(const engine of [chromium,webkit])for(const reducedMotion of ['no-preference','reduce']){
 const browser=await engine.launch(); const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion});const p=await context.newPage();
 await p.route('https://telegram.org/**',r=>r.abort());await p.route('**/api/app/bootstrap*',r=>r.fulfill({json:{mode:'demo',connected:false,empty:true,pets:[]}}));
 await p.addInitScript(()=>{window.Telegram={WebApp:{initData:'',ready(){},expand(){},enableClosingConfirmation(){}}};localStorage.setItem('pso.product.profile.v5',JSON.stringify({dogName:'Тестовый Бим',breedId:'mixed',photos:[],backendPetId:'guest-motion-check',lifeStage:'взрослая'}));localStorage.setItem('pso.topapp.onboarding.v1','done')});
 await p.goto(base,{waitUntil:'networkidle'});await p.locator('.journal-title').waitFor();
 assert.equal(await p.locator('html').getAttribute('data-pso-input'),null);
 const trigger=p.locator('.journal-ask');await trigger.focus();await trigger.hover();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);const box=await trigger.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(160);
 const scale=await trigger.evaluate(e=>getComputedStyle(e).scale);assert.equal(scale,reducedMotion==='reduce'?'none':'0.96');await p.mouse.up();
 await p.locator('dialog[aria-label="Спросить Псё"]').waitFor();
 const anim=await p.locator('dialog[aria-label="Спросить Псё"]').evaluate(e=>({count:e.getAnimations().length,transition:getComputedStyle(e).animationDuration}));
 assert.equal(anim.transition,reducedMotion==='reduce'?'0s':'0.18s');
 await p.keyboard.press('Escape');await p.locator('dialog[aria-label="Спросить Псё"]').waitFor({state:'detached'});await p.waitForTimeout(60);await trigger.focus();
 await p.keyboard.press('Enter');await p.locator('dialog[aria-label="Спросить Псё"]').waitFor();assert.equal(await p.locator('dialog[aria-label="Спросить Псё"]').evaluate(e=>getComputedStyle(e).animationDuration),'0s');
 await p.keyboard.press('Escape');await p.waitForTimeout(100);assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
 const summary=p.locator('.journal-disclosure').first().locator('summary');await summary.click();await p.waitForTimeout(250);assert.equal(await p.locator('.journal-disclosure').first().getAttribute('open'),'');
 await summary.click();await summary.click();await p.waitForTimeout(250);assert.equal(await p.locator('.journal-disclosure').first().getAttribute('open'),'');
 const disclosure=await p.locator('.journal-disclosure').first().evaluate(e=>({height:e.getBoundingClientRect().height,content:getComputedStyle(e,'::details-content').contentVisibility}));assert.ok(disclosure.height>100);
 await p.screenshot({path:`${out}/${engine.name()}-${reducedMotion}.png`});results.push({engine:engine.name(),reducedMotion,scale,anim,disclosure});await browser.close();
}
await fs.writeFile(`${out}/checks.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({ok:true,results}));
