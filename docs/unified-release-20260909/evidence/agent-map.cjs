require('tsx/cjs');
const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
const {emptyMapLibrary,applyLibraryCommand}=require('../../../lib/mapLibrary.ts');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390]){
  const t=await setup(engine,width),{page,nav,pet}=t;
  try{
   let run=null,library=emptyMapLibrary(),fail=true,posts=0,reads=0;
   const place={id:'osm-way-102',title:'Контрольный парк',detail:'Тестовый район',category:'парк',kind:'organization',point:{lat:55.753,lng:37.621},sourceUrl:'https://www.openstreetmap.org/way/102',retrievedAt:new Date().toISOString(),pointIsCenter:true,dogAccess:'unknown'};
   const key=`pso.map.active-route.v3:${pet.id}`,original=[[37.60,55.75],[37.61,55.751]];
   await page.evaluate(({key,petId,points})=>localStorage.setItem(key,JSON.stringify({version:3,petId,flow:'planning',elapsedSeconds:0,points,updatedAt:Date.now(),title:'Моя начатая прогулка',note:'Не потерять заметку',planning:{version:1,mode:'manual',stops:points.map(point=>({point}))}})),{key,petId:pet.id,points:original});
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:true,latest:run?{id:run.runId}:null}}));
   await page.route('**/api/assistant',r=>{run={runId:'map-run',threadId:'map-thread',status:'succeeded',question:r.request().postDataJSON().question,result:{runId:'map-run',threadId:'map-thread',answer:'Нашёл место на карте. Условия посещения пока неизвестны.',mode:'agent',places:[place]}};return r.fulfill({status:202,json:{runId:run.runId,threadId:run.threadId}});});
   await page.route('**/api/agent/runs/*',r=>r.fulfill({json:run}));
   await page.route('**/api/map/library**',r=>{
    if(r.request().method()==='GET'&&++reads===1)return r.fulfill({status:503,json:{error:'fixture_failure'}});
    if(r.request().method()==='POST'){
     posts++;if(fail)return r.fulfill({status:503,json:{error:'fixture_failure'}});
     library=applyLibraryCommand(library,r.request().postDataJSON().command);
    }
    return r.fulfill({json:{library}});
   });
   await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();
   let dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});await dialog.getByLabel('Вопрос ассистенту').fill('Найди контрольный парк в тестовом районе');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();
   await dialog.getByRole('button',{name:'Показать на карте'}).click();await dialog.waitFor({state:'detached'});
   let card=page.getByRole('article',{name:'Выбранное место'});await card.waitFor();await page.locator('.map-place-row').filter({hasText:place.title}).waitFor();
   assert.ok(page.url().endsWith('#map'));assert.equal(library.places.length,0);
   await page.getByText('Подборки не загрузились.',{exact:false}).first().waitFor();
   await page.getByRole('button',{name:'Повторить',exact:true}).click();
   await card.waitFor();
   await card.getByText('Показан центр объекта.',{exact:false}).waitFor();
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).planning.stops.length===2,key);
   await card.getByRole('button',{name:'Сохранить место',exact:true}).click();
   await page.getByText('Сохранение не подтверждено.',{exact:false}).first().waitFor();assert.equal(library.places.length,0);
   fail=false;await card.getByRole('button',{name:'Сохранить место',exact:true}).click();
   await page.waitForFunction(()=>document.body.innerText.includes('Сохранено в «'));
   assert.equal(posts,2);assert.equal(library.places.length,1);assert.deepEqual(library.places[0].point,place.point);
   await page.screenshot({path:`${out}/agent-map-saved-${engine}-${width}.png`});
   // Stable library ID after save must stay selected in the same linked list.
   await card.getByRole('button',{name:'Добавить в прогулку'}).click();
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).planning.stops.length===3,key);
   const planned=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
   assert.deepEqual(planned.planning.stops.slice(0,2).map(s=>s.point),original);assert.deepEqual(planned.planning.stops[2].point,[place.point.lng,place.point.lat]);assert.equal(planned.title,'Моя начатая прогулка');assert.equal(planned.note,'Не потерять заметку');
   await page.getByRole('button',{name:'К разговору',exact:true}).click();dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});await dialog.getByRole('button',{name:'Показать на карте'}).waitFor();
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();await dialog.getByRole('button',{name:'Показать на карте'}).click();
   card=page.getByRole('article',{name:'Выбранное место'});await card.waitFor();await page.locator('.map-place-row').filter({hasText:place.title}).waitFor();
   assert.equal(library.places.length,1);assert.deepEqual(t.errors,[]);
   results.push({engine,width,pass:true,scope:'synthetic provider/API; real client library reducer, persisted route draft, no live map/API claim'});console.log(`PASS ${engine}/${width}: real result reference -> exact place -> failed save/retry -> append existing route -> reload`);
  }catch(e){console.log(await page.locator('body').innerText());throw e;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/agent-map-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
