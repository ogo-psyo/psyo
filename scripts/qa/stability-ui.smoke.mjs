import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const out=process.env.OUT_DIR||'artifacts/stability';await fs.mkdir(out,{recursive:true});
const usePostgres=process.env.STABILITY_POSTGRES==='1';
// Only a dedicated local test DB; never a URL or production credential.
function sql(text){return execFileSync('/opt/homebrew/opt/docker/bin/docker',['exec','-i','supabase_db_pso-mvp','psql','-U','postgres','-d','pso_stability_20260920','-v','ON_ERROR_STOP=1','-Atq'],{input:text,encoding:'utf8'}).trim();}
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]){
 const t=await setup(engine,width),{page,ctx,pet,state}=t;
 const owner=randomUUID();let pendingReplyLost=true;const keys=[];let rows=[];const receipts=new Map();
 if(usePostgres)sql(`begin;insert into auth.users(id) values(${quote(owner)});insert into public.pets(id,owner_id,name) values(${quote(pet.id)},${quote(owner)},'Stability fixture');commit;`);
 try{
  await page.evaluate(()=>{window.__backListeners=new Set();window.__backVisible=false;window.Telegram.WebApp.BackButton={show(){window.__backVisible=true;},hide(){window.__backVisible=false;},onClick(fn){window.__backListeners.add(fn);},offClick(fn){window.__backListeners.delete(fn);}};});
  const nativeBack=async()=>{await page.waitForFunction(()=>window.__backVisible===true,{},{timeout:2000});assert.equal(await page.evaluate(()=>window.__backListeners.size),1);await page.evaluate(()=>[...window.__backListeners][0]());};
  await t.nav('profile');await page.getByRole('button',{name:'Изменить сведения',exact:true}).click();
  await page.locator('#exact-profile-dogName').fill('Черновик имени');
  await page.goBack();await page.locator('[data-exact-view=profile]').waitFor();
  await page.goForward();await page.locator('[data-exact-view=editprofile]').waitFor();
  assert.equal(await page.locator('#exact-profile-dogName').inputValue(),'Черновик имени');
  await nativeBack();await page.locator('[data-exact-view=profile]').waitFor();
  await page.waitForFunction(()=>window.__backVisible===false,{},{timeout:2000});
  await page.getByRole('button',{name:'Изменить сведения',exact:true}).click();
  state.fail=true;await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('[data-exact-view=editprofile] [role=alert]').waitFor();
  assert.equal(await page.locator('#exact-profile-dogName').inputValue(),'Черновик имени');
  await nativeBack();await page.locator('[data-exact-view=profile]').waitFor();state.fail=false;
  await page.getByRole('button',{name:'Изменить сведения',exact:true}).click();
  await page.locator('#exact-profile-dogName').focus();
  await page.setViewportSize({width,height:350});
  await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');
  const profileSave=page.getByRole('button',{name:'Сохранить',exact:true});
  await profileSave.scrollIntoViewIfNeeded();
  const profileRect=await profileSave.boundingBox();assert.ok(profileRect.y>=0&&profileRect.y+profileRect.height<=350);
  await profileSave.focus();await page.waitForTimeout(60);assert.deepEqual(await profileSave.boundingBox(),profileRect);
  await page.setViewportSize({width,height:844});await page.locator('.nav-wrap').waitFor({state:'visible'});
  await profileSave.click();await page.locator('[data-exact-view=profile]').waitFor();
  await page.getByRole('button',{name:'Документы Хранятся отдельно от разговора'}).click();
  await page.locator('[data-exact-view=documents]').waitFor();await nativeBack();await page.locator('[data-exact-view=profile]').waitFor();
  await t.nav('all');await page.locator('[data-tool-destination=health]').click();
  await page.getByRole('button',{name:'Новая запись',exact:true}).click();
  const note='Контроль реального сохранения '+engine;
  const input=page.locator('#observe-text');await input.fill(note);
  await page.evaluate(()=>{window.__qaHeight=350;Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>window.__qaHeight});window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.documentElement.dataset.psoFormKeyboard==='open');
  assert.equal(await page.locator('.nav-wrap').isVisible(),false);
  const content=await page.locator('#pso-exact-content').boundingBox();assert.ok(content.y+content.height<=350,JSON.stringify(content));
  const save=page.getByRole('button',{name:'Сохранить запись',exact:true});await save.scrollIntoViewIfNeeded();
  const rect=await save.boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=350,JSON.stringify(rect));
  await page.screenshot({path:`${out}/${engine}-keyboard.png`});
  await page.evaluate(()=>{window.__qaHeight=innerHeight;window.visualViewport.dispatchEvent(new Event('resize'));});await page.locator('.nav-wrap').waitFor({state:'visible'});
  await nativeBack();await page.getByRole('button',{name:'Новая запись',exact:true}).click();assert.equal(await input.inputValue(),note);
  await ctx.route('**/api/observations',async route=>{
   const req=route.request();if(req.method()!=='POST')return route.fallback();
   const body=req.postDataJSON(),key=req.headers()['idempotency-key'];keys.push(key);
   let receipt;
   if(usePostgres){
    const patch={type:body.type,value:body.value,note:body.note,observed_at:body.observedAt,source:'manual',metadata:{}};
    const fingerprint=createHash('sha256').update(JSON.stringify(patch)).digest('hex');
    receipt=JSON.parse(sql(`select public.care_observation_atomic(${quote(owner)},${quote(key)},${quote(fingerprint)},'create',${quote(pet.id)},${quote(JSON.stringify(patch))}::jsonb);`));
   }else{
    if(!receipts.has(key))receipts.set(key,{observation:{id:randomUUID(),pet_id:pet.id,note:body.note,value:body.value,type:'note',created_at:body.observedAt,observed_at:body.observedAt,source:'manual'},mode:'supabase'});
    receipt=receipts.get(key);
   }
   rows=[receipt.observation];
   if(pendingReplyLost){pendingReplyLost=false;return route.abort('connectionreset');}
   return route.fulfill({json:receipt});
  });
  await save.click();await page.locator('#exact-observation-error').filter({hasText:'Не удалось'}).waitFor();assert.equal(await input.inputValue(),note);
  await save.click();await page.getByText('Запись сохранена',{exact:true}).waitFor();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
  if(usePostgres){assert.equal(sql(`select count(*) from public.pet_observations where pet_id=${quote(pet.id)};`),'1');rows=JSON.parse(sql(`select coalesce(json_agg(o),'[]') from public.pet_observations o where pet_id=${quote(pet.id)} and deleted_at is null;`));}
  state.observations=rows;
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();
  await t.nav('all');await page.locator('[data-tool-destination=health]').click();await page.getByRole('button').filter({hasText:note}).click();await page.locator('.note-body').filter({hasText:note}).waitFor();
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,storage:usePostgres?'real local PostgreSQL via controlled browser adapter (auth/API transport fixture)':'receipt fixture',scenarios:'browser back/forward, Telegram latest back/no duplicate listeners, draft after back/save error, form keyboard, lost response after commit/retry one row/reload'});
 }finally{await t.browser.close();if(usePostgres)sql(`delete from auth.users where id=${quote(owner)};`);}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
