import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/form-keyboard-focus';await fs.mkdir(out,{recursive:true});const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page}=t;
 try{
  await t.nav('all');await page.locator('[data-tool-destination=health]').click();await page.getByRole('button',{name:'Добавить наблюдение',exact:true}).click();
  const input=page.locator('#observe-text');await input.fill('Текст остаётся при открытии клавиатуры');
  await page.evaluate(()=>{window.__keyboardHeight=innerHeight;Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>window.__keyboardHeight});});
  const height=async value=>{await page.evaluate(value=>{window.__keyboardHeight=value;visualViewport.dispatchEvent(new Event('resize'));},value);await page.waitForTimeout(80);};
  const visible=async label=>{
   const geometry=await input.evaluate(el=>{const target=el.getBoundingClientRect(),s=document.querySelector('#pso-exact-content'),r=s.getBoundingClientRect();return {top:target.top,bottom:target.bottom,visibleTop:r.top,visibleBottom:Math.min(r.bottom,visualViewport.height),windowScroll:scrollY,scrollTop:s.scrollTop};});
   await fs.writeFile(`${out}/${engine}-${label}.json`,JSON.stringify(geometry,null,2));await page.screenshot({path:`${out}/${engine}-${label}.png`});
   assert.ok(geometry.top>=geometry.visibleTop&&geometry.bottom<=geometry.visibleBottom,`${label}: ${JSON.stringify(geometry)}`);assert.equal(geometry.windowScroll,0);return geometry;
  };
  // Browser already focused the note at full height. No test scroll to repair
  // its position after the software keyboard reduces only visualViewport.
  await height(360);await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');await visible('keyboard-open');
  await input.press('End');await page.keyboard.type('!');await page.waitForTimeout(180);assert.ok((await input.inputValue()).endsWith('!'));
  const stable=await visible('typed');await height(360);const same=await visible('same-resize');assert.equal(same.scrollTop,stable.scrollTop);
  // Closing/reopening while the textarea keeps focus must reveal it again.
  await height(844);await page.waitForFunction(()=>!document.documentElement.dataset.psoFormKeyboard);await height(410);await visible('reopen');
  // User scroll remains owned by the user; no scroll-event feedback loop.
  await page.locator('#pso-exact-content').evaluate(el=>{el.scrollTop=Math.max(0,el.scrollTop-70);});const manual=await page.locator('#pso-exact-content').evaluate(el=>el.scrollTop);await page.waitForTimeout(120);assert.equal(await page.locator('#pso-exact-content').evaluate(el=>el.scrollTop),manual);
  // Only a fresh focus/keyboard geometry event reveals the field again.
  await height(360);await visible('resize-reveal');
  const beforeBlur=await page.locator('#pso-exact-content').evaluate(el=>el.scrollTop);await input.evaluate(el=>el.blur());await page.waitForTimeout(80);assert.equal(await page.locator('#pso-exact-content').evaluate(el=>el.scrollTop),beforeBlur);assert.equal(await page.locator('.nav-wrap').isVisible(),false);
  await height(844);await page.waitForFunction(()=>!document.documentElement.dataset.psoFormKeyboard);
  assert.ok((await input.inputValue()).endsWith('!'));assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scenarios:'focus -> keyboard without test scroll; typing; repeated resize stable; close/reopen; manual scroll not fought; blur geometry/nav stable'});
 }finally{await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
