import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/memory-screen';await fs.mkdir(out,{recursive:true});const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page,ctx,pet,state}=t;let rows=[],readFail=true,writeFail=false,deletes=0,writes=0,lost=true;const keys=[];
 try{
  await page.evaluate(()=>{window.__memoryBacks=new Set();window.Telegram.WebApp.BackButton={show(){},hide(){},onClick(fn){window.__memoryBacks.add(fn);},offClick(fn){window.__memoryBacks.delete(fn);}};});
  await ctx.route('**/api/agent/memory**',async route=>{
   const req=route.request(),body=req.postDataJSON(),reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(req.method()==='GET'){assert.equal(new URL(req.url()).searchParams.get('petId'),pet.id);return reply(readFail?{error:'TEST_READ_FAILURE'}:{memories:rows},readFail?503:200);}
   assert.equal(body.petId,pet.id);
   if(req.method()==='POST'){writes++;keys.push(body.key);if(writeFail)return reply({error:'TEST_WRITE_FAILURE'},503);let item=rows.find(x=>x.memory_key===body.key);if(!item){item={id:'m-'+writes,memory_key:body.key,content:body.content};rows.push(item);}item.content=body.content;if(lost){lost=false;return reply({error:'TEST_RESPONSE_LOST_AFTER_COMMIT'},503);}return reply({memory:item});}
   deletes++;if(writeFail)return reply({error:'TEST_DELETE_FAILURE'},503);rows=rows.filter(x=>x.memory_key!==body.key);return reply({forgotten:true});
  });
  await t.nav('profile');await page.getByRole('button',{name:'Память помощника Что учитывать в разговорах'}).click();
  const screen=page.locator('[data-exact-view=memory]');await screen.getByRole('alert').waitFor();assert.equal(await screen.locator('.memory-add').count(),0);
  readFail=false;await screen.getByRole('button',{name:'Повторить',exact:true}).click();await screen.locator('.memory-add').waitFor();
  assert.equal(await screen.locator('textarea').count(),1);assert.equal(await screen.getByRole('button',{name:'Перейти в чат'}).count(),0);
  await page.waitForFunction(()=>[...document.querySelectorAll('.memory-illustration')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await screen.locator('.memory-illustration').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.ok(await screen.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:`${out}/${engine}-empty.png`});
  await screen.locator('#memory-new').fill('Любим тихие прогулки');
  await page.evaluate(()=>{window.__memoryKeyboard=360;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>window.__memoryKeyboard});visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');await page.waitForTimeout(100);
  const box=await screen.locator('#memory-new').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=360,JSON.stringify(box));
  await page.evaluate(()=>{window.__memoryKeyboard=innerHeight;visualViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>!document.documentElement.dataset.psoFormKeyboard);

  await screen.getByRole('button',{name:'Запомнить',exact:true}).click();await screen.getByRole('alert').waitFor();
  assert.equal(rows.length,1);assert.equal(await screen.locator('#memory-new').inputValue(),'Любим тихие прогулки');
  await screen.getByRole('button',{name:'Запомнить',exact:true}).click();await screen.getByText('Любим тихие прогулки',{exact:true}).waitFor();
  assert.equal(rows.length,1);assert.equal(keys[0],keys[1]);
  assert.equal(state.requests.filter(r=>r.method!=='GET'&&/assistant|agent/.test(r.path)).length,0);
  rows.push({id:'m-two',memory_key:'Игрушки',content:'Без пищалок'});
  await page.reload();await page.locator('.app-tabs').waitFor();await t.nav('profile');await page.getByRole('button',{name:'Память помощника Что учитывать в разговорах'}).click();
  await screen.getByText('Любим тихие прогулки',{exact:true}).waitFor();assert.equal(await screen.locator('textarea').count(),0);
  await page.screenshot({path:`${out}/${engine}-saved.png`});
  const first=screen.locator('.memory-item').first();await first.getByRole('button',{name:'Изменить'}).click();await first.getByLabel('Что учитывать').fill('Отменяемый текст');await first.getByRole('button',{name:'Отмена'}).click();assert.equal(writes,2);await first.getByText('Любим тихие прогулки',{exact:true}).waitFor();
  await first.getByRole('button',{name:'Изменить'}).click();await first.getByLabel('Что учитывать').fill('Гуляем утром без площадок');
  writeFail=true;await first.getByRole('button',{name:'Сохранить',exact:true}).click();await screen.getByRole('alert').waitFor();assert.equal(await first.getByLabel('Что учитывать').inputValue(),'Гуляем утром без площадок');
  writeFail=false;await first.getByRole('button',{name:'Сохранить',exact:true}).click();await first.getByText('Гуляем утром без площадок',{exact:true}).waitFor();assert.equal(rows[1].content,'Без пищалок');
  await page.evaluate(()=>{window.__memoryBacks=new Set();window.Telegram.WebApp.BackButton={show(){},hide(){},onClick(fn){window.__memoryBacks.add(fn);},offClick(fn){window.__memoryBacks.delete(fn);}};});
  // A reload replaces the synthetic Telegram SDK; browser Back still restores profile.

  await page.goBack();await page.locator('[data-exact-view=profile]').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Память помощника Что учитывать в разговорах'}).click();await screen.getByText('Гуляем утром без площадок',{exact:true}).waitFor();
  writeFail=true;await first.getByRole('button',{name:'Забыть',exact:true}).click();await screen.getByRole('alert').waitFor();assert.equal(rows.length,2);
  writeFail=false;await first.getByRole('button',{name:'Забыть',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.memory-item').length===1);assert.equal(rows[0].content,'Без пищалок');
  await screen.getByRole('button',{name:'Забыть',exact:true}).click();await screen.locator('.memory-add').waitFor();assert.equal(rows.length,0);assert.equal(deletes,3);
  await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await screen.locator('.memory-illustration').evaluate(el=>getComputedStyle(el).animationIterationCount),'1');
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scope:'mock API; direct-memory input/no-chat, lost save response/retry one record, reload, edit/cancel/save error/retry, forget error/retry/other-item-safe, motion'});
 }finally{await t.browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
