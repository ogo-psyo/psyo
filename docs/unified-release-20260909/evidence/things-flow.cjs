const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const evidence=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390,1280]){
  const t=await setup(engine,width),{page,nav,pet,state}=t;
  try {
   let createCount=0,patchFail=false,deleteFail=true,restoreFail=true,bootstrapFail=false,removed=null;const keys=[];let lastPatch;let receiptMode="";let assistantFailure=true,lastCreate;
   await page.route('**/api/app/bootstrap*',route=>bootstrapFail?route.fulfill({status:503,json:{error:'fixture_bootstrap_failure'}}):route.fallback());
   await page.route('**/api/wishlist',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    const request=route.request().postDataJSON();lastCreate=request;createCount++;keys.push(route.request().headers()['idempotency-key']);
    await new Promise(resolve=>setTimeout(resolve,350));
    if(createCount===1)return route.fulfill({status:503,json:{error:'fixture_write_failure'}});
    if(request.source==='assistant'&&assistantFailure){assistantFailure=false;return route.fulfill({status:503,json:{error:'fixture_assistant_write_failure'}});}
    const item={id:request.source==='assistant'?'assistant-wish':request.plannedFor?'planned-wish':'first-wish',petId:pet.id,title:request.title,reason:request.reason,category:request.category,priority:'medium',status:'wanted',plannedFor:request.plannedFor,reminderId:request.plannedFor?'wish-reminder':undefined};
    if(receiptMode) return route.fulfill({status:201,json:{mode:receiptMode==='demo'?'demo':'user',item:{...item,petId:receiptMode==='foreign'?'other-pet':pet.id}}});
    state.wishlist=[item,...state.wishlist.filter(old=>old.id!==item.id)];
    const reminder=request.plannedFor?{id:'wish-reminder',petId:pet.id,title:'Купить: '+request.title,dueAt:request.dueAt,status:'active',recurrence:'none',type:'food'}:null;
    if(reminder)state.reminders.push(reminder);
    return route.fulfill({json:{item,reminder},status:201});
   });
   await page.route('**/api/wishlist/*',async route=>{
    const request=route.request(),id=new URL(request.url()).pathname.split('/').at(-1);
    if(request.method()==='PATCH'){
     lastPatch=request.postDataJSON();if(patchFail)return route.fulfill({status:503,json:{error:'fixture_patch_failure'}});
     const item=state.wishlist.find(item=>item.id===id);Object.assign(item,lastPatch);if(lastPatch.status==='wanted'){delete item.plannedFor;delete item.reminderId;}
     return route.fulfill({json:{item:{...item,pet_id:pet.id,petId:undefined}}});
    }
    if(request.method()==='DELETE'){
     if(deleteFail){deleteFail=false;return route.abort();}
     removed=state.wishlist.find(item=>item.id===id);state.wishlist=state.wishlist.filter(item=>item.id!==id);return route.fulfill({json:{ok:true}});
    }return route.fallback();
   });
   await page.route('**/api/wishlist/*/restore',route=>{
    if(restoreFail){restoreFail=false;return route.fulfill({status:503,json:{error:'fixture_restore_failure'}});}
    state.wishlist.push(removed);return route.fulfill({json:{item:{...removed,pet_id:pet.id,petId:undefined}}});
   });
   await page.route('**/api/reminders/wish-reminder/complete',route=>{
    const completedAt=route.request().postDataJSON().completedAt;const old=state.reminders.find(r=>r.id==='wish-reminder');old.status='done';old.completedAt=completedAt;state.wishlist.find(item=>item.id==='planned-wish').status='bought';
    return route.fulfill({json:{reminder:{id:old.id,pet_id:pet.id,title:old.title,type:old.type,due_at:old.dueAt,completed_at:completedAt,status:'done',recurrence:'none'},historyOccurrence:{reminderId:old.id,dueAt:old.dueAt,completedAt},nextOccurrence:null}});
   });
   await nav('things');const capture=page.locator('.thing-capture'),input=capture.getByLabel('Нужно купить',{exact:true});
   await input.fill('Корм для проверки');bootstrapFail=true;
   await capture.evaluate(form=>{form.requestSubmit();form.requestSubmit();});await capture.getByRole('alert').waitFor();assert.equal(createCount,1,'double submit created a second request');
   await nav('nearby');assert.equal(await page.getByRole('alert').filter({hasText:'подтвердить покупку'}).count(),0);await nav('things');assert.equal(await input.inputValue(),'Корм для проверки');
   await capture.getByRole('button',{name:'Добавить в вещи',exact:true}).click();await page.locator('[data-wishlist-id="first-wish"]').waitFor();assert.equal(createCount,2);assert.equal(keys[0],keys[1]);assert.equal(await input.inputValue(),'');
   assert.equal(state.wishlist[0].plannedFor,undefined);assert.equal(state.wishlist[0].reminderId,undefined);
   const item=page.locator('[data-wishlist-id="first-wish"]');await item.getByRole('button',{name:'Изменить: Корм для проверки',exact:true}).click();
   const editor=item.locator('.wishlist-edit-form');await editor.getByLabel('Название',{exact:true}).fill('Корм после исправления');patchFail=true;await editor.getByRole('button',{name:'Сохранить',exact:true}).click();await item.getByRole('alert').waitFor();
   await editor.getByRole('button',{name:'Закрыть',exact:true}).click();await item.getByRole('button',{name:'Изменить: Корм для проверки',exact:true}).click();assert.equal(await editor.getByLabel('Название',{exact:true}).inputValue(),'Корм после исправления');
   patchFail=false;await editor.getByRole('button',{name:'Сохранить',exact:true}).click();await editor.waitFor({state:'detached'});assert.equal(lastPatch.reason,'');
   await item.getByRole('button',{name:'Куплено',exact:true}).click();await page.locator('[aria-label="История вещей"] [data-wishlist-id="first-wish"]').waitFor();
   await item.getByRole('button',{name:'Вернуть',exact:true}).click();await page.locator('[aria-label="Вещи собаки"] [data-wishlist-id="first-wish"]').waitFor();
   await item.getByText('Подробнее',{exact:true}).click();await item.getByRole('button',{name:'Убрать',exact:true}).click();await item.getByRole('alert').waitFor();await item.getByRole('button',{name:'Убрать',exact:true}).click();await item.waitFor({state:'detached'});
   const restore=page.locator('.restore-notice');await restore.getByRole('button',{name:'Вернуть',exact:true}).click();await restore.getByRole('alert').waitFor();await restore.getByRole('button',{name:'Вернуть',exact:true}).click();await item.waitFor();await restore.waitFor({state:'detached'});
   for(const mode of ['foreign','demo']){receiptMode=mode;await input.fill('Не подтверждённая покупка');await capture.getByRole('button',{name:'Добавить в вещи',exact:true}).click();await capture.getByRole('alert').waitFor();assert.equal(await input.inputValue(),'Не подтверждённая покупка');assert.equal(state.wishlist.length,1);}
   receiptMode='';await input.fill('Корм к пятнице');await capture.getByText('Категория, пояснение и срок',{exact:true}).click();await capture.getByRole('checkbox').check();
   await capture.getByLabel('Купить до',{exact:true}).fill('2026-09-11');await capture.getByRole('button',{name:'Добавить в вещи и план',exact:true}).click();const planned=page.locator('[data-wishlist-id="planned-wish"]');await planned.waitFor();
   await planned.getByRole('button',{name:'Куплено',exact:true}).click();await page.locator('[aria-label="История вещей"] [data-wishlist-id="planned-wish"]').waitFor();assert.equal(state.reminders.find(item=>item.id==='wish-reminder').status,'done');
   await page.screenshot({path:`${out}/things-result-${engine}-${width}.png`});
   bootstrapFail=false;await page.reload();await page.locator('[data-wishlist-id="first-wish"]').waitFor();await page.locator('[data-wishlist-id="planned-wish"]').waitFor();
   await input.fill('Мой отдельный черновик');await capture.getByText('Категория, пояснение и срок',{exact:true}).click();await capture.getByRole('checkbox').check();await capture.getByLabel('Купить до',{exact:true}).fill('2026-09-12');await capture.getByLabel('Зачем',{exact:false}).fill('Моё пояснение');
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:false}}));
   await page.route('**/api/assistant',r=>r.fulfill({json:{answer:'Можно добавить отдельную покупку.',provider:'groq',mode:'groq_contextual',actionSuggestions:[{intent:'add_wishlist',humanLabel:'Добавить покупку из ответа',destination:{screen:'things',mode:'create'},payload:{title:'Адресник из разговора'}}]}}));
   await page.getByRole('button',{name:'Спросить Псё',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});await dialog.getByLabel('Вопрос ассистенту').fill('Добавь адресник');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();await dialog.getByRole('button',{name:'Добавить покупку из ответа',exact:true}).click();await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Повторить',exact:true}).click();await dialog.getByText('Действие сохранено',{exact:true}).waitFor();
   assert.equal(lastCreate.plannedFor,undefined);assert.equal(lastCreate.dueAt,undefined);assert.equal(lastCreate.reason,null);assert.equal(lastCreate.category,'other');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await input.inputValue(),'Мой отдельный черновик');assert.equal(await capture.getByRole('checkbox').isChecked(),true);assert.equal(await capture.getByRole('alert').count(),0);await page.locator('[data-wishlist-id="assistant-wish"]').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(t.errors,[]);
   evidence.push({engine,width,pass:true,api:'synthetic, real client flow; not cloud/RLS/provider proof'});console.log(`PASS ${engine}/${width}: add once/retry, direct receipts despite bootstrap failure, edit draft, complete, remove/restore, linked care, reload`);
  }catch(error){await page.screenshot({path:`${out}/things-failure-${engine}-${width}.png`});throw error;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/things-flow-ui.json',JSON.stringify(evidence,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
