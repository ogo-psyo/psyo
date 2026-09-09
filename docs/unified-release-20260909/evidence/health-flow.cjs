const assert=require('node:assert/strict');
const {setup,out}=require('./harness.cjs');
(async()=>{for(const engine of ['chromium','webkit'])for(const width of [320,390,1280]){
 const t=await setup(engine,width),{page,ctx,state,pet}=t;
 const key=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
 const stamp=new Date().toISOString(),old='2026-07-11T09:00:00Z';
 state.observations=[{id:key(3),petId:pet.id,note:'Исходный текст сразу, без раскрытия',createdAt:stamp,observedAt:stamp,mood:'спокойное',appetite:'обычный',energy:'ниже обычного'},{id:key(2),petId:pet.id,note:'Вторая запись той же минуты',createdAt:stamp,observedAt:stamp},{id:key(1),petId:pet.id,note:'Старая запись июля',createdAt:old,observedAt:old,type:'weight',value:'17 кг',stool:'обычный'}];
 await ctx.route('**/api/app/bootstrap*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'owner',connected:true,activePetId:pet.id,pet,pets:[pet],profile:t.profile,observations:state.observations.slice(0,2),documents:[],reminders:[],wishlist:[],zones:[],routes:[],avatarCapabilities:{identityEnabled:true,uploadsEnabled:true,generationEnabled:false,providerReady:false}})}));
 const writes=[];let readFail=false,writeFail=false,invalid='',removed=null,restoreFail=false;
 const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 await ctx.route('**/api/health?*',async route=>{const u=new URL(route.request().url()),before=u.searchParams.get('before');if(readFail)return json(route,{error:'fixture'},503);const rows=before?state.observations.slice(2):state.observations.slice(0,2);return json(route,{entries:rows,hasMore:!before&&state.observations.length>2,nextCursor:!before?JSON.stringify({at:stamp,id:key(2)}):null});});
 await ctx.route('**/api/observations**',async route=>{
  const req=route.request(),u=new URL(req.url());if(req.method()==='GET')return json(route,{observations:state.observations.slice(0,2)});
  writes.push({method:req.method(),key:req.headers()['idempotency-key'],body:req.postDataJSON()});
  await new Promise(r=>setTimeout(r,150));
  if(writeFail)return json(route,{error:'fixture'},503);
  if(u.pathname.endsWith('/restore')){if(restoreFail)return json(route,{error:'fixture'},503);state.observations.unshift(removed);return json(route,{observation:removed,restored:true});}
  const id=u.pathname.split('/').at(-1),data=req.postDataJSON();
  if(req.method()==='DELETE'){removed=state.observations.find(x=>x.id===id);state.observations=state.observations.filter(x=>x.id!==id);return json(route,{ok:true,deletedAt:stamp,canRestore:true});}
  if(req.method()==='PATCH'){const i=state.observations.findIndex(x=>x.id===id);state.observations[i]={...state.observations[i],...data};return json(route,{observation:state.observations[i]});}
  if(invalid==='empty')return json(route,{});
  const saved={id:key(100+writes.length),petId:invalid==='foreign'?'foreign-pet':pet.id,...data,createdAt:data.observedAt};
  if(invalid==='foreign')saved.petId='foreign-pet';
  if(invalid==='demo')return json(route,{mode:'demo',observation:saved});
  if(invalid)return json(route,{observation:saved});
  state.observations.unshift(saved);return json(route,{observation:saved});
 });
 const nav=async()=>{await t.nav('all');await page.locator('[data-tool-destination="health"]').click();await page.getByRole('heading',{name:'Записи и здоровье',exact:true}).waitFor();};
 try{
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await nav();
  const screen=page.locator('.health-screen');
  await screen.getByText('Исходный текст сразу, без раскрытия',{exact:true}).waitFor();
  assert.equal(await screen.locator('#health-capture').count(),0);
  assert.equal(await screen.locator('[data-observation-id]').count(),2);
  assert.match(await screen.locator(`[data-observation-id="${key(3)}"]`).innerText(),/ниже обычного/);
  readFail=true;await screen.getByRole('button',{name:'Загрузить более ранние'}).click();
  await screen.getByRole('alert').filter({hasText:'Не удалось загрузить'}).waitFor();
  assert.equal(await screen.getByText('Исходный текст сразу, без раскрытия',{exact:true}).isVisible(),true);
  readFail=false;await screen.getByRole('button',{name:'Загрузить более ранние'}).click();await screen.getByText('Старая запись июля',{exact:true}).waitFor();
  assert.equal(await screen.locator('[data-observation-id]').count(),3);
  const metricsEntry=screen.locator(`[data-observation-id="${key(3)}"]`);
  await metricsEntry.getByRole('button',{name:'Изменить',exact:true}).click();
  await metricsEntry.locator('.observation-edit-context summary').click();
  await metricsEntry.getByRole('button',{name:'спокойное',exact:true}).click();
  await metricsEntry.getByRole('button',{name:'Сохранить запись',exact:true}).click();
  await metricsEntry.locator('.structured-observation-editor').waitFor({state:'hidden'});
  assert.doesNotMatch(await metricsEntry.innerText(),/спокойное/);assert.match(await metricsEntry.innerText(),/ниже обычного/);
  const weightEntry=screen.locator(`[data-observation-id="${key(1)}"]`);
  assert.match(await weightEntry.innerText(),/Вес: 17 кг/);
  await weightEntry.getByRole('button',{name:'Изменить',exact:true}).click();
  await weightEntry.getByLabel('Вес',{exact:true}).fill('16,8 кг');
  await weightEntry.getByRole('button',{name:'Сохранить запись',exact:true}).click();await weightEntry.locator('.structured-observation-editor').waitFor({state:'hidden'});
  assert.match(await weightEntry.innerText(),/Вес: 16,8 кг/);
  assert.equal(writes.at(-1).body.type,'weight');
  writes.length=0;

  await screen.getByRole('button',{name:'Добавить запись',exact:true}).click();
  const capture=screen.locator('#health-capture');await capture.getByLabel('Текст записи',{exact:true}).fill('Текст после обрыва сети');
  writeFail=true;await capture.evaluate(form=>{form.requestSubmit();form.requestSubmit();});await capture.getByRole('alert').waitFor();
  assert.equal(writes.length,1);assert.equal(await capture.getByLabel('Текст записи').inputValue(),'Текст после обрыва сети');
  await screen.getByRole('button',{name:'Свернуть запись',exact:true}).click();await t.nav('nearby');assert.equal(await page.getByText('Не удалось подтвердить изменение.',{exact:false}).count(),0);await nav();
  await screen.getByRole('button',{name:'Добавить запись',exact:true}).click();assert.equal(await capture.getByLabel('Текст записи').inputValue(),'Текст после обрыва сети');
  writeFail=false;readFail=true;await capture.getByRole('button',{name:'Записать наблюдение'}).click();await capture.waitFor({state:'hidden'});await screen.locator('.health-record-text').filter({hasText:'Текст после обрыва сети'}).waitFor();
  assert.equal(writes[0].key,writes[1].key);assert.equal(await capture.count(),0);assert.match(await page.evaluate(()=>document.activeElement.textContent),/Добавить запись/);
  const savedId=await screen.locator('[data-observation-id]').filter({hasText:'Текст после обрыва сети'}).getAttribute('data-observation-id');
  const entry=screen.locator(`[data-observation-id="${savedId}"]`);
  await entry.getByRole('button',{name:'Изменить',exact:true}).click();let editor=entry.locator('.structured-observation-editor');
  await editor.getByLabel('Текст записи').fill('Исправленный полный текст');writeFail=true;await editor.getByRole('button',{name:'Сохранить запись'}).click();await entry.getByRole('alert').waitFor();
  await editor.getByRole('button',{name:'Свернуть',exact:true}).click();await entry.getByRole('button',{name:'Изменить',exact:true}).click();assert.equal(await editor.getByLabel('Текст записи').inputValue(),'Исправленный полный текст');
  writeFail=false;await editor.getByRole('button',{name:'Сохранить запись'}).click();await editor.waitFor({state:'hidden'});await screen.getByText('Исправленный полный текст',{exact:true}).waitFor();
  const edited=screen.locator('[data-observation-id]').filter({hasText:'Исправленный полный текст'});
  writeFail=true;await edited.getByRole('button',{name:'Убрать',exact:true}).click();await edited.getByRole('alert').waitFor();writeFail=false;await edited.getByRole('button',{name:'Убрать',exact:true}).click();await screen.getByRole('button',{name:'Вернуть запись',exact:true}).waitFor();assert.equal(await edited.count(),0);
  restoreFail=true;await screen.getByRole('button',{name:'Вернуть запись',exact:true}).click();await screen.locator('.health-restore').getByRole('alert').waitFor();restoreFail=false;await screen.getByRole('button',{name:'Вернуть запись',exact:true}).click();await screen.getByText('Исправленный полный текст',{exact:true}).waitFor();
  await screen.getByRole('button',{name:'Добавить запись',exact:true}).click();await capture.getByLabel('Текст записи').fill('Не принимать неверную квитанцию');
  for(const kind of ['empty','foreign','demo']){invalid=kind;await capture.getByRole('button',{name:'Записать наблюдение'}).click();await capture.getByRole('alert').waitFor();assert.equal(await capture.getByLabel('Текст записи').inputValue(),'Не принимать неверную квитанцию');assert.equal(await screen.locator('[data-observation-id]').filter({hasText:'Не принимать неверную квитанцию'}).count(),0);}
  invalid='';readFail=false;
  await screen.locator('.health-facts summary').click();
  const originalAllergies=await page.evaluate(()=>JSON.parse(localStorage.getItem('pso.product.profile.v5')).allergies);
  await screen.getByLabel('Аллергии',{exact:true}).fill('Неизменённый до сохранения черновик');
  await ctx.route('**/api/v1/pets',route=>json(route,{error:'fixture'},503));
  await screen.getByRole('button',{name:'Сохранить постоянные данные'}).click();
  await screen.locator('.health-facts').getByRole('alert').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pso.product.profile.v5')).allergies),originalAllergies);
  await t.nav('nearby');assert.equal(await page.getByText('Не удалось сохранить личный профиль.',{exact:false}).count(),0);await nav();
  await screen.locator('.health-facts summary').click();assert.equal(await screen.getByLabel('Аллергии',{exact:true}).inputValue(),'Неизменённый до сохранения черновик');
  await screen.locator('.health-facts summary').click();

  await screen.getByRole('button',{name:'Свернуть запись',exact:true}).click();
  await page.screenshot({path:`${out}/health-${engine}-${width}.png`,fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await nav();await screen.getByText('Исправленный полный текст',{exact:true}).waitFor();
  await screen.getByRole('button',{name:'Загрузить более ранние'}).click();await screen.getByText('Старая запись июля',{exact:true}).waitFor();
  assert.match(await screen.locator(`[data-observation-id="${key(1)}"]`).innerText(),/Вес: 16,8 кг/);
  assert.deepEqual(t.errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(`PASS ${engine}/${width}: original text/metrics, older page/reload, failed read keeps rows, create/edit/delete/restore/retry, stable key/one POST, invalid receipts, retained close/back drafts`);
 }catch(e){await page.screenshot({path:`${out}/health-failed-${engine}-${width}.png`,fullPage:true});console.log((await page.locator('body').innerText()).slice(-9000));throw e;}finally{await t.browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
