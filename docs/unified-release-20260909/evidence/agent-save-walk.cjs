const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390]){
  const t=await setup(engine,width),{page,nav,pet}=t;
  try{
   const id='22222222-2222-4222-8222-222222222222',path=[[37.6,55.75],[37.601,55.751]];
   const route={id,petId:pet.id,type:'route',title:'Прогулка у пруда',description:'',routeSource:'planned',visibility:'private',path:{type:'LineString',coordinates:path},pathGaps:[],distanceMeters:150,planning:{version:1,mode:'walking',stops:[{point:path[0],title:'Начало'},{point:path[1],title:'Пруд'}],estimatedMinutes:2}};
   let run=null,mode='failed-empty',requests=0,routeReads=0;
   const key=`pso.map.active-route.v3:${pet.id}`,original=[[37.62,55.75],[37.621,55.751]];
   await page.evaluate(({key,petId,points})=>localStorage.setItem(key,JSON.stringify({version:3,petId,flow:'planning',elapsedSeconds:0,points,updatedAt:Date.now(),title:'Другой план',note:'Сохранить черновик',planning:{version:1,mode:'manual',stops:points.map(point=>({point}))}})),{key,petId:pet.id,points:original});
   const committed=()=>({id,title:route.title,available:mode!=='removed'});
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:true,latest:run?{id:run.id}:null}}));
   await page.route('**/api/assistant',r=>{requests++;run={id:`save-run-${requests}`,runId:`save-run-${requests}`,threadId:'save-thread',status:mode==='cancel'?'running':'failed',question:r.request().postDataJSON().question,result:null,committedWalk:mode==='failed-empty'?null:committed()};return r.fulfill({status:202,json:{runId:run.id,threadId:run.threadId}});});
   await page.route('**/api/agent/runs/*',r=>{if(r.request().method()==='DELETE'){run.status='cancelled';return r.fulfill({json:{ok:true,committedWalk:run.committedWalk}});}return r.fulfill({json:{...run,committedWalk:mode==='removed'?committed():run.committedWalk}});});
   await page.route('**/api/map/features/**',r=>{routeReads++;assert.equal(r.request().method(),'GET');return r.fulfill({json:{route}});});
   async function open(){await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();return page.getByRole('dialog',{name:'Спросить Псё',exact:true});}
   let dialog=await open();await dialog.getByLabel('Вопрос ассистенту').fill('Сохрани прогулку');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();
   await dialog.getByRole('button',{name:'Повторить запрос',exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Открыть сохранённую прогулку'}).count(),0);
   mode='failed-committed';await dialog.getByRole('button',{name:'Повторить запрос',exact:true}).click();
   const button=()=>dialog.getByRole('button',{name:'Открыть сохранённую прогулку',exact:true});await button().waitFor();await dialog.getByText('Прогулка сохранена.',{exact:true}).waitFor();assert.equal(await button().count(),1);
   await button().click();const view=page.getByRole('region',{name:'Сохранённая прогулка',exact:true});await view.waitFor();await view.getByText('Пруд',{exact:true}).waitFor();
   assert.deepEqual((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).points,original);
   await page.getByRole('button',{name:'К разговору',exact:true}).click();await button().waitFor();
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();dialog=await open();await button().click();await view.waitFor();await page.getByRole('button',{name:'К разговору',exact:true}).click();
   mode='cancel';await dialog.getByLabel('Вопрос ассистенту').fill('Сохрани прогулку');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();await dialog.getByRole('button',{name:'Остановить',exact:true}).click();await button().waitFor();await dialog.getByText('Запрошена остановка задания.',{exact:true}).waitFor();
   await page.screenshot({path:`${out}/agent-save-walk-${engine}-${width}.png`});
   mode='removed';await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();dialog=await open();await dialog.getByText('Прогулка была сохранена, но теперь удалена или недоступна.',{exact:true}).waitFor();assert.equal(await button().count(),0);
   assert.equal(routeReads,2);assert.equal(requests,3);assert.deepEqual(t.errors,[]);
   results.push({engine,width,pass:true,scope:'real built UI, synthetic APIs; SQL write tested separately'});console.log(`PASS ${engine}/${width}: precommit failure -> retry -> committed route despite answer failure -> canonical Map -> original draft/reload -> cancellation receipt -> removed state`);
  }catch(e){console.log(await page.locator('body').innerText());throw e;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/agent-save-walk-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
