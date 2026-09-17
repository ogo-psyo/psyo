import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/composer-keyboard';await fs.mkdir(out,{recursive:true});
const results=[];
for(const engine of ['chromium','webkit'])for(const width of [320,390]){
 const t=await setup(engine,width),{page}=t;
 try{
  const input=page.locator('#connected-question'),nav=page.locator('.nav-wrap');
  await input.fill('Пойдём гулять после дождя');
  assert.equal(await nav.isVisible(),true,'hardware keyboard / focus alone must not hide navigation');
  // iOS shrinks only the VisualViewport; layout viewport remains unchanged.
  await page.evaluate(()=>{window.__qaHeight=window.innerHeight;Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>window.__qaHeight});window.__qaHeight=350;window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.documentElement.dataset.psoComposerKeyboard==='open');
  await page.waitForTimeout(80);
  assert.equal(await nav.isVisible(),false);
  let rect=await page.locator('[data-connected-home] .composer').boundingBox();
  assert.ok(rect.y>=0&&rect.y+rect.height<=350,`composer outside keyboard viewport: ${JSON.stringify(rect)}`);
  await input.press('End');await input.press('Shift+Enter');await input.type('И возьмём мяч');
  assert.match(await input.inputValue(),/мяч/);
  await page.screenshot({path:`${out}/${engine}-${width}-keyboard.png`});
  // OS keyboard dismiss can leave the textarea focused.
  await page.evaluate(()=>{window.__qaHeight=window.innerHeight;window.visualViewport.dispatchEvent(new Event('resize'));});
  await nav.waitFor({state:'visible'});assert.match(await input.inputValue(),/мяч/);
  // Telegram / Android may resize the whole webview instead.
  await page.evaluate(()=>{delete window.visualViewport.height;});
  await page.setViewportSize({width,height:350});
  await page.waitForFunction(()=>document.documentElement.dataset.psoComposerKeyboard==='open');
  rect=await page.locator('[data-connected-home] .composer').boundingBox();assert.ok(rect.y+rect.height<=350);
  // Touching Send blurs textarea first. The form must not move before click.
  const send=page.getByRole('button',{name:'Отправить сообщение',exact:true});
  const before=await send.boundingBox();await send.focus();await page.waitForTimeout(60);
  assert.deepEqual(await send.boundingBox(),before);
  let submitted=0;
  await page.route('**/api/assistant',r=>{submitted++;return r.fulfill({json:{answer:'Тестовый ответ',provider:'test',suggestedQuestions:[]}});});
  await send.click();await page.waitForFunction(()=>Boolean(document.querySelector('[data-exact-conversation]')));
  await page.waitForTimeout(250);assert.equal(submitted,1);
  await page.setViewportSize({width,height:844});await nav.waitFor({state:'visible'});
  const followup=page.locator('#production-assistant-question');await followup.fill('А вечером?');
  await page.setViewportSize({width,height:350});
  await page.waitForFunction(()=>document.documentElement.dataset.psoComposerKeyboard==='open');
  await followup.click();
  rect=await page.locator('[data-assistant-composer]').boundingBox();
  assert.ok(rect.y>=0&&rect.y+rect.height<=350,`followup composer outside viewport: ${JSON.stringify(rect)}`);
  await page.setViewportSize({width,height:844});await nav.waitFor({state:'visible'});
  assert.equal(await followup.inputValue(),'А вечером?');
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scope:'emulated visual/layout viewport, not physical iPhone keyboard'});
 }finally{await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
