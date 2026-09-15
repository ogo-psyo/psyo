import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {setup,fs}=require('../../docs/unified-release-20260909/evidence/harness.cjs');
const results=[];await fs.mkdir('artifacts/assistant-sheet-ui',{recursive:true});
for(const engine of ['chromium','webkit'])for(const width of [320,390]){
 const t=await setup(engine,width),{page,nav,state,pet}=t;
 try{
  await page.setViewportSize({width,height:width===320?568:844});
  let requests=0,writes=0;
  await page.route('**/api/assistant',r=>{requests++;return r.fulfill({json:requests===1?{
   answer:'Начните с более тихого участка.',provider:'groq',mode:'groq_contextual',threadId:'thread-1',suggestedQuestions:['Как подготовиться к прогулке?'],
   actionSuggestions:[{intent:'create_reminder',destination:{screen:'calendar',mode:'create'},humanLabel:'Поставить короткую тренировку',payload:{title:'10 минут спокойной прогулки'}}]
  }:{answer:'Открою планирование без выдуманной стартовой точки.',provider:'groq',mode:'groq_contextual',threadId:'thread-1',actionSuggestions:[{intent:'plan_walk',destination:{screen:'map',mode:'plan_walk'},humanLabel:'Запланировать прогулку',payload:{title:'Спокойная прогулка',note:'Избегать самокатов'}}]}});});
  await page.route('**/api/reminders',r=>{writes++;const body=r.request().postDataJSON();const reminder={id:'assistant-reminder',petId:pet.id,title:body.title,type:'custom',dueAt:new Date().toISOString(),status:'active',createdAt:new Date().toISOString()};state.reminders.push(reminder);return r.fulfill({json:{reminder}});});
  await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();
  const dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true}),input=dialog.getByLabel('Вопрос ассистенту');
  await input.fill('Как сделать прогулку спокойнее?');await input.press('Enter');
  await dialog.getByText('Начните с более тихого участка.',{exact:true}).waitFor();
  await dialog.getByText('Ещё по теме',{exact:true}).click();await dialog.getByRole('button',{name:'Как подготовиться к прогулке?'}).waitFor();
  await dialog.getByRole('button',{name:'Поставить короткую тренировку'}).click();
  await dialog.getByText('Действие сохранено',{exact:true}).waitFor();assert.equal(writes,1);
  const composer=await dialog.locator('[data-assistant-composer]').boundingBox();assert.ok(composer.y+composer.height<=page.viewportSize().height+1);
  await input.fill('Запланируй прогулку');await input.press('Enter');
  await dialog.getByRole('button',{name:'Запланировать прогулку',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.ok(page.url().endsWith('#map'));await page.getByRole('region',{name:'Построить заранее'}).waitFor();
  assert.ok(await page.locator('[data-route-flow="planning"]').getByText('0 точек',{exact:false}).count(),'route must not invent coordinates');
  assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scope:'synthetic APIs; actual legacy typed actions retained'});
 }finally{await t.browser.close();}
}
await fs.writeFile('artifacts/assistant-sheet-ui/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
