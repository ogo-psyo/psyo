import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:3293';
const out=process.env.OUT_DIR||'artifacts/profile-settings';await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,width] of [['chromium',390],['webkit',320]]) {
 const browser=await({chromium,webkit}[engine]).launch();
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 let pets=[{id:'11111111-1111-4111-8111-111111111111',name:'Плутон',breed_id:'mixed',life_stage:'взрослый'},{id:'22222222-2222-4222-8222-222222222222',name:'Луна',breed_id:'mixed',life_stage:'взрослый'}];
 let active=pets[0].id, failDelete=true,loseDeleteReply=false,releaseDelete=null;const deletes=[],errors=[],billingRequests=[];
 await context.addInitScript(()=>{window.__backListeners=new Set();Object.defineProperty(window,'Telegram',{value:{WebApp:{initData:'qa-fixture-not-authentication',ready(){},expand(){},enableClosingConfirmation(){},BackButton:{show(){},hide(){},onClick(fn){window.__backListeners.add(fn);},offClick(fn){window.__backListeners.delete(fn);}}}}});});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const json=(data,status=200)=>route.fulfill({json:data,status});
  if(url.pathname.includes('/billing/'))billingRequests.push(url.pathname);
  if(url.pathname==='/api/v1/session/telegram')return json({mode:'telegram',session:{psyoUserId:'qa-user',ownerId:'qa-owner'}});
  if(url.pathname==='/api/app/bootstrap') {const pet=pets.find(p=>p.id===(url.searchParams.get('petId')||active))||pets[0]||null;return json({mode:'owner',connected:true,empty:!pet,pet,profile:null,pets,activePetId:pet?.id,avatarCapabilities:{identityEnabled:true,uploadsEnabled:false,generationEnabled:false,providerReady:false},reminders:[],documents:[],observations:[],routes:[],zones:[],wishlist:[]});}
  if(url.pathname==='/api/v1/pets'&&req.method()==='DELETE') {
   const body=req.postDataJSON();deletes.push(body);assert.equal(body.confirmation,'DELETE_DOG');
   if(failDelete)return json({error:'QA_DELETE_FAILURE'},503);
   if(!pets.some(p=>p.id===body.petId))return json({error:'PET_NOT_FOUND'},404);
   if(releaseDelete===null)await new Promise(resolve=>{releaseDelete=resolve;});
   pets=pets.filter(p=>p.id!==body.petId);if(active===body.petId)active=pets[0]?.id;
   if(loseDeleteReply){loseDeleteReply=false;return route.abort('failed');}
   return json({deletedPetId:body.petId});
  }
  if(url.pathname==='/api/v1/pets'&&req.method()==='PATCH'){active=req.postDataJSON().activePetId;return json({activePetId:active});}
  if(url.pathname==='/api/v1/account'&&req.method()==='DELETE'){deletes.push(req.postDataJSON());return json({error:'QA_ACCOUNT_FAILURE'},503);}
  return json({});
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const openSettings=async()=>{await page.locator('.nav [data-route=profile]').click();await page.getByRole('button',{name:/Настройки/}).click();await page.getByRole('heading',{name:'Данные и доступ',exact:true}).waitFor();};
 const openDog=()=>page.getByRole('button',{name:/Удалить профиль собаки/}).click();
 try {
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#pso-exact-interface[data-auth-ready="true"]').waitFor();await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await openSettings();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.getByText(/Псё Плюс|Оформить через Telegram/).count(),0);assert.deepEqual(billingRequests,[]);
  const fonts=await page.locator('.profile-settings-screen :is(h1,h2,p,b,small,button,a)').evaluateAll(els=>els.map(el=>getComputedStyle(el).fontFamily));assert.ok(fonts.length>8&&fonts.every(f=>f.startsWith('Naris')),fonts.join('\n'));
  await page.screenshot({path:`${out}/${engine}-settings.png`});
  const dialog=page.getByRole('dialog');
  await openDog();await page.getByRole('heading',{name:'Удалить профиль «Плутон»?',exact:true}).waitFor();
  assert.equal(await dialog.locator('input').count(),0);
  assert.equal(await dialog.getByRole('button',{name:'Отмена',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'native modal traps focus');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(deletes.length,0);
  assert.equal(await page.getByRole('button',{name:/Удалить профиль собаки/}).evaluate(el=>el===document.activeElement),true);
  await openDog();await page.evaluate(()=>[...window.__backListeners].forEach(fn=>fn()));await dialog.waitFor({state:'hidden'});await page.getByRole('heading',{name:'Данные и доступ',exact:true}).waitFor();assert.equal(deletes.length,0);
  await openDog();await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(deletes.length,0);
  // Bulk account deletion is separate and requires its own typed confirmation.
  await page.getByRole('button',{name:/Удалить аккаунт/}).click();
  assert.equal(await dialog.getByRole('button',{name:'Удалить аккаунт',exact:true}).isDisabled(),true);
  await dialog.getByRole('textbox').fill('УДАЛИТЬ АККАУНТ');await dialog.getByRole('button',{name:'Удалить аккаунт',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.equal(deletes.at(-1).confirmation,'DELETE_ACCOUNT');
  await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(pets.length,2);deletes.length=0;
  await openDog();await dialog.getByRole('button',{name:'Удалить профиль',exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert.equal(deletes.length,1);assert.equal(pets.length,2);assert.equal(deletes[0].petId,pets[0].id);
  await page.screenshot({path:`${out}/${engine}-delete-error.png`});
  failDelete=false;await dialog.getByRole('button',{name:'Удалить профиль',exact:true}).click();
  await dialog.getByRole('button',{name:'Удаляю…',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Отмена',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Удаляю…',exact:true}).evaluate(el=>{el.click();el.click();});await page.keyboard.press('Escape');await page.evaluate(()=>[...window.__backListeners].forEach(fn=>fn()));assert.equal(await dialog.isVisible(),true);
  assert.equal(deletes.length,2);assert.equal(typeof releaseDelete,'function');releaseDelete();
  await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Луна',exact:true}).first().waitFor();
  assert.deepEqual(pets.map(p=>p.name),['Луна']);await page.reload({waitUntil:'domcontentloaded'});await openSettings();
  await openDog();await page.getByRole('heading',{name:'Удалить профиль «Луна»?',exact:true}).waitFor();
  await page.screenshot({path:`${out}/${engine}-delete-confirm.png`});
  loseDeleteReply=true;await dialog.getByRole('button',{name:'Удалить профиль',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.equal(pets.length,0,'delete committed but response lost');
  await dialog.getByRole('button',{name:'Удалить профиль',exact:true}).click();
  await page.getByRole('heading',{name:'Давай знакомиться',exact:true}).waitFor();assert.equal(pets.length,0);assert.equal(deletes.at(-1).petId,'22222222-2222-4222-8222-222222222222');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Давай знакомиться',exact:true}).waitFor();assert.equal(await page.locator('.profile-deletion-dialog').count(),0);
  // Guest cleanup stays local and cannot expose the account deletion command.
  const guest=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const guestWrites=[];
  await guest.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();if(req.method()!=='GET')guestWrites.push(url.pathname);return route.fulfill({json:url.pathname==='/api/app/bootstrap'?{mode:'demo',connected:false,empty:true,pet:null,pets:[]}: {}});});
  const gp=await guest.newPage();await gp.goto(base,{waitUntil:'domcontentloaded'});await gp.locator('#pso-exact-interface[data-auth-ready="true"]').waitFor();
  await gp.getByRole('button',{name:'Познакомимся',exact:true}).click();await gp.getByLabel('Имя собаки').fill('Боня');await gp.getByRole('dialog').getByRole('button',{name:'Добавить собаку',exact:true}).click();
  await gp.getByRole('heading',{name:'Фото собаки',exact:true}).waitFor();await gp.getByRole('button',{name:'Не сейчас',exact:true}).click();
  await gp.locator('.nav [data-route=profile]').click();await gp.getByRole('button',{name:/Настройки/}).click();
  assert.equal(await gp.getByRole('button',{name:/Удалить аккаунт/}).count(),0);
  await gp.getByRole('button',{name:/Очистить данные на этом устройстве/}).click();const gd=gp.getByRole('dialog');
  assert.equal(await gd.getByRole('button',{name:'Очистить данные',exact:true}).isDisabled(),true);
  await gd.getByRole('textbox').fill('ОЧИСТИТЬ ДАННЫЕ');await gd.getByRole('button',{name:'Очистить данные',exact:true}).click();
  await gp.getByRole('heading',{name:'Давай знакомиться',exact:true}).waitFor();await gp.reload();await gp.getByRole('heading',{name:'Давай знакомиться',exact:true}).waitFor();
  assert.deepEqual(guestWrites,[]);await guest.close();
  assert.deepEqual(errors,[]);results.push({engine,width,pass:true,scope:'Naris/no Plus, cancel/Escape/Telegram Back/focus, account failure, dog failure/retry/single send, other dog preserved, last dog lost-response/404 retry/reload, guest local-only cleanup; fixture API only'});
 } catch(e){await page.screenshot({path:`${out}/${engine}-failure.png`});await fs.writeFile(`${out}/${engine}-failure.txt`,await page.locator('body').innerText());throw e;}finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
