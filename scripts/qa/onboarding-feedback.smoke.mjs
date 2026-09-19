import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:3291';
const out=process.env.OUT_DIR||'artifacts/onboarding-feedback';
await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]) {
 const browser=await({chromium,webkit}[engine]).launch();
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 let pet=null,failCreate=true,failUpload=true,failActivate=true;const requests=[],errors=[];
 await context.addInitScript(()=>Object.defineProperty(window,'Telegram',{value:{WebApp:{initData:'qa-fixture-not-authentication',ready(){},expand(){},enableClosingConfirmation(){}}}}));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const json=(data,status=200)=>route.fulfill({json:data,status});
  if(req.method()!=='GET')requests.push({path:url.pathname,body:req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null,key:req.headers()['idempotency-key']});
  if(url.pathname==='/api/v1/session/telegram')return json({mode:'telegram',session:{psyoUserId:'qa-user',ownerId:'qa-owner'}});
  if(url.pathname==='/api/app/bootstrap')return json({mode:'owner',connected:true,empty:!pet,pet,pets:pet?[pet]:[],activePetId:pet?.id,avatarCapabilities:{identityEnabled:true,uploadsEnabled:true,generationEnabled:false,providerReady:false},reminders:[],documents:[],observations:[],routes:[],zones:[],wishlist:[]});
  if(url.pathname==='/api/v1/onboarding/activate'){
   if(failCreate)return json({error:'QA_CREATE_FAILURE'},503);
   const data=req.postDataJSON();pet={id:'11111111-1111-4111-8111-111111111111',name:data.name,life_stage:data.lifeStage,sex:data.sex,breed_id:data.breedId,breed_group_id:data.breedGroupId,custom_breed:data.breedCustom,avatar_source:'none',profile_version:0};return json({petId:pet.id});
  }
  if(url.pathname.endsWith('/avatar/assets'))return failUpload?json({error:'QA_UPLOAD_FAILURE'},503):json({asset:{id:'asset-test',renderUrl:`${base}/demo-avatar.png`}});
  if(url.pathname.endsWith('/activate')&&url.pathname.includes('/avatar/')){
   if(failActivate)return json({error:'QA_ACTIVATE_FAILURE'},503);
   pet.avatar_source='uploaded';pet.avatar_url=`${base}/demo-avatar.png`;return json({ok:true});
  }
  if(url.pathname==='/api/agent/runs')return json({enabled:false});
  return json({});
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.telegram-pill:not(.mode-loading)').waitFor();await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.getByText('Добавить образ',{exact:true}).count(),0);
  await page.screenshot({path:`${out}/${engine}-welcome.png`});
  await page.getByRole('button',{name:'Добавить собаку',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Профиль собаки'});
  assert.equal(await dialog.getByLabel('Возраст',{exact:true}).inputValue(),'');
  assert.equal(await dialog.getByLabel('Порода',{exact:true}).inputValue(),'');
  assert.equal(await dialog.locator('datalist').count(),0);
  await dialog.getByLabel('Имя собаки').fill('Жульен');
  await dialog.getByLabel('Возраст',{exact:true}).fill('Щенок 11 месяцев');
  await dialog.getByLabel('Порода',{exact:true}).fill('лабрадудль');
  await dialog.getByRole('radio',{name:'Кобель',exact:true}).check();
  const styles=await dialog.evaluate(el=>({surface:getComputedStyle(el).backgroundColor,font:getComputedStyle(el.querySelector('input')).fontFamily,button:getComputedStyle(el.querySelector('button.primary')).backgroundImage}));
  assert.equal(styles.surface,'rgb(250, 249, 252)');assert.match(styles.font,/Naris/);assert.equal(styles.button,'none');
  await page.screenshot({path:`${out}/${engine}-form.png`});
  await dialog.getByRole('button',{name:'Добавить собаку',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Возраст',{exact:true}).inputValue(),'Щенок 11 месяцев');
  failCreate=false;await dialog.getByRole('button',{name:'Добавить собаку',exact:true}).click();
  await page.getByRole('heading',{name:'Фото собаки',exact:true}).waitFor();
  const creates=requests.filter(r=>r.path==='/api/v1/onboarding/activate');assert.equal(creates.length,2);assert.equal(creates[0].key,creates[1].key);assert.equal(creates[1].body.lifeStage,'Щенок 11 месяцев');assert.equal(creates[1].body.breedCustom,'лабрадудль');
  await page.screenshot({path:`${out}/${engine}-photo-empty.png`});
  await page.getByRole('button',{name:'Не сейчас',exact:true}).click();
  await page.locator('.nav [data-route=today]').click();
  await page.getByRole('button',{name:'Добавить фото: Жульен',exact:true}).click();
  const photo=page.locator('[data-exact-view=identity]');
  await photo.getByLabel('Фотография собаки',{exact:true}).setInputFiles('public/demo-avatar.png');
  await photo.getByRole('alert').waitFor();assert.equal(await photo.getByRole('button',{name:'Использовать',exact:true}).count(),0);
  failUpload=false;await photo.getByLabel('Фотография собаки',{exact:true}).setInputFiles('public/demo-avatar.png');
  await photo.getByRole('button',{name:'Использовать',exact:true}).click();
  await photo.getByText('Не удалось применить образ. Черновик сохранён, можно повторить.',{exact:true}).waitFor();
  failActivate=false;await photo.getByRole('button',{name:'Использовать',exact:true}).click();
  await photo.getByRole('button',{name:'Готово',exact:true}).waitFor();
  await page.screenshot({path:`${out}/${engine}-photo-saved.png`});
  await photo.getByRole('button',{name:'Готово',exact:true}).click();
  await page.locator('.nav [data-route=today]').click();
  assert.equal(await page.locator('.home-dog-photo img').count(),1);
  await page.screenshot({path:`${out}/${engine}-home.png`});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.home-dog-photo img').waitFor();
  assert.equal(await page.locator('.first-run-activation').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  pet=null;await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Добавить собаку',exact:true}).click();
  await dialog.getByLabel('Имя собаки').fill('Луна');
  assert.equal(await dialog.getByLabel('Возраст',{exact:true}).inputValue(),'');
  await dialog.getByRole('button',{name:'Добавить собаку',exact:true}).click();
  await page.getByRole('heading',{name:'Фото собаки',exact:true}).waitFor();
  const minimal=requests.filter(r=>r.path==='/api/v1/onboarding/activate').at(-1).body;
  assert.equal(minimal.lifeStage,'');assert.equal(minimal.sex,'');assert.equal(minimal.breedCustom,'');
  assert.deepEqual(errors,[]);results.push({engine,width,pass:true,scope:'first run, arbitrary input, create fail/retry same key, photo skip/reentry, upload and activation error/retry, saved home avatar, returning user; fixture APIs only'});
 } catch(e) {await page.screenshot({path:`${out}/${engine}-failure.png`});await fs.writeFile(`${out}/${engine}-failure.txt`,await page.locator('body').innerText());throw e;}
 finally {await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
