const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390]){
  const t=await setup(engine,width),{page,nav,pet}=t;
  try{
   const id='22222222-2222-4222-8222-222222222222',path=[[37.6,55.75],[37.61,55.75],[37.62,55.76],[37.63,55.76]];
   const route={id,petId:pet.id,type:'route',title:'Вчера у пруда',description:'Вода у второго входа',routeSource:'recorded',visibility:'private',path:{type:'LineString',coordinates:path},pathGaps:[2],distanceMeters:1500,startedAt:'2026-09-08T16:00:00Z',planning:{version:1,mode:'manual',stops:[{point:path[0],title:'Первый вход'},{point:path[3],title:'У пруда'}]}};
   let run=null,responseStatus=404,writes=0,reads=0;
   const key=`pso.map.active-route.v3:${pet.id}`,original=[[37.60,55.75],[37.601,55.751]];
   await page.evaluate(({key,petId,points})=>localStorage.setItem(key,JSON.stringify({version:3,petId,flow:'planning',elapsedSeconds:0,points,updatedAt:Date.now(),title:'Мой текущий план',note:'Не заменять',planning:{version:1,mode:'manual',stops:points.map(point=>({point}))}})),{key,petId:pet.id,points:original});
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:true,latest:run?{id:run.id}:null}}));
   await page.route('**/api/assistant',r=>{run={id:'read-run',runId:'read-run',threadId:'read-thread',status:'succeeded',question:r.request().postDataJSON().question,result:{runId:'read-run',threadId:'read-thread',answer:'Нашёл сохранённую прогулку.',mode:'agent',savedWalks:[{id,title:route.title}]}};return r.fulfill({status:202,json:{runId:run.id,threadId:run.threadId}});});
   await page.route('**/api/agent/runs/*',r=>r.fulfill({json:run}));
   await page.route('**/api/map/features/**',r=>{reads++;assert.equal(r.request().method(),'GET');assert.equal(new URL(r.request().url()).searchParams.get('petId'),pet.id);return r.fulfill({status:responseStatus,json:responseStatus===200?{route}:{error:responseStatus===404?'ROUTE_NOT_FOUND':'ROUTE_READ_FAILED'}});});
   await page.route('**/api/map/features',r=>{if(r.request().method()!=='GET')writes++;return r.fulfill({json:{features:[]}});});
   async function open(){await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();return page.getByRole('dialog',{name:'Спросить Псё',exact:true});}
   let dialog=await open();await dialog.getByLabel('Вопрос ассистенту').fill('Открой вчерашнюю прогулку');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();
   const button=()=>dialog.getByRole('button',{name:'Открыть сохранённую прогулку'});
   await button().click();await dialog.getByText('Эта прогулка удалена или больше недоступна.',{exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Сохранённая прогулка',exact:true}).count(),0);
   responseStatus=503;await button().click();await dialog.getByText('Не удалось загрузить прогулку. Попробуйте ещё раз.',{exact:true}).waitFor();
   responseStatus=200;await button().click();let view=page.getByRole('region',{name:'Сохранённая прогулка',exact:true});await view.waitFor();
   await view.getByText(route.description,{exact:true}).waitFor();await view.getByText('У пруда',{exact:true}).waitFor();assert.equal(await view.getByRole('button',{name:'Повторить маршрут',exact:true}).isDisabled(),true);
   const downloadPromise=page.waitForEvent('download');await view.getByRole('button',{name:'Скачать GPX'}).click();const download=await downloadPromise;const gpx=await fs.readFile(await download.path(),'utf8');assert.equal((gpx.match(/<trkseg>/g)||[]).length,2);assert.ok(gpx.includes('У пруда'));assert.ok(gpx.includes('37.63'));
   const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.deepEqual(restored.points,original);assert.equal(restored.note,'Не заменять');assert.equal(writes,0);
   await page.screenshot({path:`${out}/agent-saved-walk-${engine}-${width}.png`});
   await page.getByRole('button',{name:'К разговору',exact:true}).click();await button().waitFor();
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();dialog=await open();await button().click();await view.waitFor();assert.equal(reads,4);assert.equal(writes,0);assert.deepEqual(t.errors,[]);
   results.push({engine,width,pass:true,scope:'real frontend; synthetic canonical route/agent APIs; no live cloud/provider claim'});console.log(`PASS ${engine}/${width}: deleted/error/retry -> fresh canonical route -> GPX gaps -> original draft retained -> reload fetch`);
  }catch(e){console.log(await page.locator('body').innerText());throw e;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/agent-saved-walk-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
