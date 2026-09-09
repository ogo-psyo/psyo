const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390,1280]){
  const t=await setup(engine,width),{page,nav,pet,profile}=t;
  try {
   let attempts=0;let latest=null;
   await page.route('**/api/agent/runs?*',route=>route.fulfill({json:{enabled:true,latest}}));
   await page.route('**/api/agent/runs/qa-recent',route=>route.fulfill({json:{status:'succeeded',question:'Вчерашний настоящий запрос из API',result:{answer:'Сохранённый ответ из API',runId:'qa-recent',threadId:'qa-thread',provider:'groq'}}}));
   await page.route('**/api/assistant',route=>{attempts++;return route.fulfill({status:attempts===1?503:200,json:attempts===1?{error:'fixture_failure'}:{answer:'Ответ на введённый вопрос',threadId:'qa-thread',provider:'groq',mode:'groq_contextual'}});});
   await nav('map');await nav('today'); // remount with test-owned recent endpoint
   const home=page.locator('[data-connected-home]');await home.waitFor();
   const navigation=page.locator('[data-connected-navigation]');
   const material=await home.evaluate(el=>{const input=el.querySelector('textarea'),h=el.querySelector('h1');return {input:parseFloat(getComputedStyle(input).fontSize),border:getComputedStyle(input).borderTopWidth,heading:parseFloat(getComputedStyle(h).fontSize)};});
   assert.ok(material.input>=24&&material.heading>=44,'legacy CSS shrank grouped entry');assert.equal(material.border,'0px');
   assert.deepEqual(await navigation.locator('button[data-route]').allTextContents(),['Псё','Карта','Гав','Всё','Профиль']);
   assert.equal(await home.getByRole('button',{name:/Продолжить разговор/}).count(),0,'no invented recent conversation');
   assert.equal(await home.getByRole('button',{name:'Отправить сообщение'}).isDisabled(),true);
   await page.screenshot({path:`${out}/connected-home-${engine}-${width}.png`});
   const input=home.getByLabel('Сообщение Псё');await input.fill('Хочу обсудить прогулку без повторного ввода');await input.press('Enter');
   const dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});await dialog.getByRole('alert').waitFor();
   assert.equal(attempts,1);assert.equal(await dialog.getByLabel('Вопрос ассистенту').inputValue(),'Хочу обсудить прогулку без повторного ввода');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await input.inputValue(),'Хочу обсудить прогулку без повторного ввода');
   await page.waitForFunction(()=>document.activeElement?.id==='connected-question');
   await input.press('Enter');await dialog.getByText('Ответ на введённый вопрос',{exact:true}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(attempts,2);
   await nav('all');await page.screenshot({path:`${out}/connected-tools-${engine}-${width}.png`});
   for(const destination of ['diary','calendar','health','habits','things','card']){
    await page.locator(`[data-tool-destination="${destination}"]`).click();
    await page.waitForFunction(hash=>location.hash===`#${hash}`,destination);
    assert.equal(await navigation.locator('button[aria-current="page"]').getAttribute('data-route'),'all');
    if(destination==='diary'){
     const day=page.locator('.journal-day');await day.getByRole('button',{name:/Контрольная запись для открытия/}).click();
     await page.locator('dialog[data-record-id="o1"]').waitFor();await page.keyboard.press('Escape');
     await day.getByRole('button',{name:/Завершённое контрольное дело/}).click();await page.locator('dialog[data-record-id="r-done"]').waitFor();await page.keyboard.press('Escape');
    }
    await page.getByRole('button',{name:/^(← )?Назад$/,exact:false}).first().click();
    await page.locator('[data-connected-tools]').waitFor();
    await page.waitForFunction(id=>document.activeElement?.getAttribute('data-tool-destination')===id,destination);
   }
   await page.locator('[data-tool-destination="passport"]').click();await page.locator('[data-profile-memory][data-surface="passport"]').waitFor();
   await page.getByRole('button',{name:'Вернуться к обзору',exact:true}).click();await page.locator('[data-connected-tools]').waitFor();
   await nav('profile');await page.locator('[data-profile-memory][data-surface="overview"]').waitFor();
   latest={id:'qa-recent',question:'Вчерашний настоящий запрос из API',thread_id:'qa-thread',status:'succeeded'};
   await page.goto('http://127.0.0.1:3285/#today');await page.reload();
   await home.getByRole('button',{name:/Вчерашний настоящий запрос из API/}).click();await dialog.getByText('Сохранённый ответ из API',{exact:true}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   await page.setViewportSize({width,height:480});await input.fill('Короткий экран');await input.focus();
   await home.getByRole('button',{name:'Отправить сообщение'}).scrollIntoViewIfNeeded();
   const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,font:parseFloat(getComputedStyle(document.querySelector('#connected-question')).fontSize),send:document.querySelector('[data-connected-home] button[type="submit"]').getBoundingClientRect().toJSON(),nav:document.querySelector('[data-connected-navigation]').getBoundingClientRect().toJSON()}));
   assert.equal(geometry.overflow,false);assert.ok(geometry.font>=16);assert.ok(geometry.send.bottom<=480);if(width<1024)assert.ok(geometry.send.bottom<=geometry.nav.top,'navigation covers input action');
   await input.blur();await page.setViewportSize({width,height:844});
   pet.name='Мята Длинное-Имя-Собаки-Для-Проверки';profile.dogName=pet.name;
   await page.reload();await home.getByRole('button',{name:`Открыть профиль ${pet.name}`}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'long dog name creates overflow');
   if(width>=1024)assert.equal(await page.locator('.desktop-context-panel').count(),0,'care sidebar competes with free question');
   assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scope:'actual local UI; all API synthetic; viewport resize is not physical keyboard acceptance'});
   console.log(`PASS ${engine}/${width}: real submit/retry/return, all destinations, exact record, saved conversation, short viewport`);
  }catch(error){await page.screenshot({path:`${out}/connected-failure-${engine}-${width}.png`});throw error;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/connected-shell-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
