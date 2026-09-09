const assert=require('node:assert/strict');
const {setup,fs,out}=require('./harness.cjs');
(async()=>{
 for(const engine of ['chromium','webkit']) {
  const t=await setup(engine,390),{page,nav,state,pet}=t;
  try {
   const saved=[];
   await page.route('**/api/v1/pets',async route=>{
    const body=route.request().postDataJSON();saved.push(body);
    if(saved.length===1) {pet.profile_version=1;state.remoteAlone='Изменено на другом устройстве';return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'PROFILE_VERSION_CONFLICT'})});}
    pet.profile_version=2;state.remoteAlone=body.profile.aloneTime;
    return route.fulfill({contentType:'application/json',body:JSON.stringify({pet:{id:pet.id,profileVersion:2}})});
   });
   await nav('profile');
   await page.getByRole('button',{name:/Паспорт и привычки/}).click();
   await page.getByRole('button',{name:'Характер',exact:true}).click();
   const trigger=page.getByRole('button',{name:'Уточнить портрет',exact:true});await trigger.click();
   const editor=page.locator('dialog[aria-labelledby="profile-editor-title"]');
   await editor.getByLabel('Как остаётся один').fill('Мой важный ввод');
   await editor.getByRole('button',{name:'Сохранить',exact:true}).click();
   const conflict=page.getByRole('dialog',{name:'Профиль изменился'});await conflict.waitFor();
   assert.equal(await conflict.getByRole('radio').count(),2);
   assert.ok(await conflict.evaluate(e=>e.contains(document.activeElement)));
   await page.screenshot({path:`${out}/conflict-${engine}.png`});
   await page.keyboard.press('Escape');await conflict.waitFor({state:'detached'});
   assert.equal(await editor.getByLabel('Как остаётся один').inputValue(),'Мой важный ввод');
   await page.waitForFunction(()=>document.querySelector('dialog[aria-labelledby="profile-editor-title"]')?.contains(document.activeElement));
   // Retry same stale draft, then resolve overlap explicitly.
   saved.length=0;
   await editor.getByRole('button',{name:'Сохранить',exact:true}).click();await conflict.waitFor();
   await conflict.getByRole('radio',{name:/Ваш ввод/}).check();
   await conflict.getByRole('button',{name:'Сохранить выбранное'}).click();
   await editor.waitFor({state:'hidden'});
   assert.equal(saved[1].profile.profileVersion,1);
   assert.equal(saved[1].profile.aloneTime,'Мой важный ввод');
   assert.equal(saved[0].profile.profileVersion,0);
   try { await page.waitForFunction(element=>element===document.activeElement,await trigger.elementHandle(),{timeout:2000}); } catch(e) { console.log('FOCUS',await page.evaluate(()=>({tag:document.activeElement.tagName,html:document.activeElement.outerHTML.slice(0,400),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.getAttribute('aria-labelledby'))})));throw e; }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(t.errors,[]);
   console.log(`PASS ${engine}: conflict values, modal focus, Escape retains draft, explicit resolution uses new version, save returns to same trigger`);
  }finally{await t.browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
