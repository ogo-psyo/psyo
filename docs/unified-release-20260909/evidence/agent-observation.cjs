const assert=require('node:assert/strict');
const {setup,fs,out}=require('./harness.cjs');
const results=[];
(async()=>{
for(const engine of ['chromium','webkit'])for(const width of [320,390]){
 const t=await setup(engine,width),{page,state,pet,nav}=t;
 const blank={mood:'',appetite:'',stool:'',energy:''};
 let run=null,draft=null,record=null,attempts=[],fail=true,serial=0;
 const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 try{
  await page.route('**/api/agent/runs?*',r=>json(r,{enabled:true,latest:run?{id:run.runId}:null}));
  await page.route('**/api/assistant',r=>{
   const body=r.request().postDataJSON();serial++;
   run={runId:`run-${serial}`,threadId:'thread-1',question:body.question,status:'succeeded'};
   draft={id:`draft-${serial}`,run_id:run.runId,pet_id:pet.id,source_text:body.question,metrics:blank,observed_at:new Date().toISOString(),status:'draft',observation_id:null};
   record=null;
   run.result={answer:'Подготовил запись. Проверьте текст перед сохранением.',threadId:run.threadId,runId:run.runId,mode:'agent',observationDraftId:draft.id,sources:[]};
   // First is asynchronous; second covers an already-completed request replay.
   return json(r,serial===1?{runId:run.runId,threadId:run.threadId}:run.result,serial===1?202:200);
  });
  await page.route('**/api/agent/runs/*',r=>json(r,run));
  await page.route('**/api/agent/observation-drafts/*',r=>{
   if(r.request().method()==='POST'){
    const body=r.request().postDataJSON();attempts.push(body);
    if(fail)return json(r,{error:'SAVE_FAILED'},503);
    if(!record){record={id:'saved-observation',pet_id:pet.id,type:'note',value:body.note,note:body.note,source:'assistant',observed_at:body.observedAt,created_at:new Date().toISOString(),metadata:{...body.metrics,source_text:draft.source_text}};state.observations.unshift(record);}
    draft={...draft,status:'saved',observation_id:record.id};
   }
   if(r.request().method()==='DELETE')draft={...draft,status:'discarded'};
   return json(r,{draft,observation:record});
  });
  await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё',exact:true}).click();
  let sheet=page.getByRole('dialog',{name:'Спросить Псё'});
  await sheet.getByLabel('Вопрос ассистенту').fill('После прогулки Мята спокойно отдыхала. Просто хочу оставить заметку.');
  await sheet.getByRole('button',{name:'Отправить',exact:true}).click();
  let card=sheet.locator('[data-agent-observation]');await card.waitFor();
  assert.equal(state.observations.length,1,'preparation must not create canonical observation');
  assert.equal(await card.getByLabel('Что сохранить').inputValue(),draft.source_text);
  await card.getByLabel('Что сохранить').fill('Уточнение: после прогулки спокойно отдыхала.');
  await card.getByRole('button',{name:'Сохранить запись',exact:true}).click();
  await card.getByRole('alert').waitFor();
  await sheet.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё',exact:true}).click();
  sheet=page.getByRole('dialog',{name:'Спросить Псё'});card=sheet.locator('[data-agent-observation]');
  assert.equal(await card.getByLabel('Что сохранить').inputValue(),'Уточнение: после прогулки спокойно отдыхала.');
  await card.screenshot({path:`${out}/agent-observation-draft-${engine}-${width}.png`});
  fail=false;await card.getByRole('button',{name:'Сохранить запись',exact:true}).click();
  await card.getByRole('button',{name:'Открыть запись'}).waitFor();
  assert.deepEqual(attempts[0],attempts[1]);assert.equal(state.observations.length,2);
  await card.getByRole('button',{name:'Открыть запись'}).click();
  const detail=page.locator('dialog[data-record-id="saved-observation"]');await detail.waitFor();
  assert.match(await detail.innerText(),/Уточнение: после прогулки спокойно отдыхала/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement?.textContent==='Открыть запись');
  await card.screenshot({path:`${out}/agent-observation-saved-${engine}-${width}.png`});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();
  await nav('profile');await page.getByRole('button',{name:/Здоровье и документы/}).click();
  const entry=page.locator('article').filter({hasText:'Уточнение: после прогулки спокойно отдыхала.'}).filter({has:page.getByRole('button',{name:'Открыть запись'})});
  await entry.getByRole('button',{name:'Открыть запись'}).click();await detail.waitFor();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Вернуться к обзору'}).click();await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё',exact:true}).click();
  sheet=page.getByRole('dialog',{name:'Спросить Псё'});await sheet.locator('[data-agent-observation]').getByRole('button',{name:'Открыть запись'}).waitFor();
  await sheet.getByLabel('Вопрос ассистенту').fill('Новая заметка, которую я пока не хочу сохранять');
  await sheet.getByRole('button',{name:'Отправить',exact:true}).click();
  card=sheet.locator('[data-agent-observation="draft-2"]');await card.getByRole('button',{name:'Не сохранять'}).click();
  await card.getByText('Черновик убран. Запись не создавалась.').waitFor();
  assert.equal(state.observations.length,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(t.errors,[]);
  results.push({engine,width,pass:true,scope:'intercepted API only; separate real local SQL test'});
  console.log(`PASS ${engine}/${width}: prepare/edit/failure/close/retry/same record/reload/history/discard and completed-request replay`);
 }catch(e){console.log(await page.locator('body').innerText());throw e;}finally{await t.browser.close();}
}
await fs.writeFile(out+'/agent-observation-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
