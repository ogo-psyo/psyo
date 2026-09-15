const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390]){
  const t=await setup(engine,width),{page,nav,pet,profile,state}=t;
  try{
   const walk={title:'К пруду по дорожкам',path:[[37.61,55.75],[37.615,55.751],[37.62,55.75]],stops:[{point:[37.61,55.75],title:'Начало у парка',placeId:'osm-way-1'},{point:[37.62,55.75],title:'Пруд',placeId:'osm-way-2'}],snaps:[{point:[37.61,55.75],distanceMeters:8},{point:[37.62,55.75],distanceMeters:12}],distanceMeters:750,estimatedMinutes:10,stairs:true,source:'OpenStreetMap',calculatedAt:'2026-09-09T08:00:00Z'};
   let run=null,saved=null,fail=true;const writes=[];
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:true,latest:run?{id:run.id}:null}}));
   await page.route('**/api/assistant',r=>{run={id:'walk-run',runId:'walk-run',threadId:'walk-thread',status:'succeeded',question:r.request().postDataJSON().question,result:{runId:'walk-run',threadId:'walk-thread',answer:'Путь рассчитан. Проверьте привязку к дорожкам на карте.',mode:'agent',walk,places:walk.stops.map((s,i)=>({id:s.placeId,title:s.title,detail:'Тестовый район',category:'парк',kind:'organization',point:{lng:s.point[0],lat:s.point[1]},sourceUrl:`https://www.openstreetmap.org/way/${i+1}`,retrievedAt:'2026-09-09T08:00:00Z',pointIsCenter:true,dogAccess:'unknown'}))}};return r.fulfill({status:202,json:{runId:run.id,threadId:run.threadId}});});
   await page.route('**/api/agent/runs/*',r=>r.fulfill({json:run}));
   await page.route('**/api/map/features',r=>{
    if(r.request().method()!=='POST')return r.fulfill({json:{features:saved?[saved]:[]}});
    writes.push({body:r.request().postDataJSON(),key:r.request().headers()['idempotency-key']});
    if(fail)return r.fulfill({status:503,json:{error:'fixture_failure'}});
    saved={...writes.at(-1).body,id:'saved-walk',path:{type:'LineString',coordinates:writes.at(-1).body.path}};
    return r.fulfill({status:201,json:{feature:saved}});
   });
   async function open(){await nav('profile');await page.locator('.journal-masthead').getByRole('button',{name:'Спросить Псё'}).click();return page.getByRole('dialog',{name:'Спросить Псё',exact:true});}
   let dialog=await open();await dialog.getByLabel('Вопрос ассистенту').fill('Построй путь от парка до пруда');await dialog.getByRole('button',{name:'Отправить',exact:true}).click();
   await dialog.getByRole('button',{name:'Посмотреть прогулку'}).click();
   let preview=page.getByRole('region',{name:'Предпросмотр прогулки'});await preview.waitFor();
   await page.getByRole('button',{name:'К разговору',exact:true}).click();
   dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});await dialog.getByRole('button',{name:'Показать на карте'}).first().click();
   await page.getByRole('article',{name:'Выбранное место'}).waitFor();assert.equal(await preview.count(),0);
   await page.getByRole('button',{name:'К разговору',exact:true}).click();await dialog.getByRole('button',{name:'Посмотреть прогулку'}).click();await preview.waitFor();
   await preview.getByText('Пруд — до дорожки 12 м',{exact:true}).waitFor();assert.equal(writes.length,0);
   await page.screenshot({path:`${out}/agent-walk-preview-${engine}-${width}.png`});
   await preview.getByRole('button',{name:'Использовать этот путь'}).click();
   await page.getByRole('button',{name:'Сохранить лично',exact:true}).click();
   await page.getByText('Не удалось сохранить место на карте',{exact:true}).waitFor();assert.equal(saved,null);
   fail=false;await page.getByRole('button',{name:'Сохранить лично',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('[data-map-composer-content]'));
   assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.equal(saved.visibility,'private');assert.deepEqual(saved.path.coordinates,walk.path);assert.equal(saved.planning.stops[1].title,'Пруд');assert.equal(saved.planning.stairs,true);
   await page.route('**/api/app/bootstrap',r=>r.fulfill({json:{mode:'owner',connected:true,activePetId:pet.id,pet,pets:[pet],profile,social:{},observations:state.observations,documents:state.documents,reminders:state.reminders,wishlist:[],zones:[],routes:saved?[saved]:[]}}));
   // The persisted proposal restores after a fresh app load, independently of the client map draft.
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();dialog=await open();await dialog.getByRole('button',{name:'Посмотреть прогулку'}).click();await preview.waitFor();
   await preview.getByRole('button',{name:'Закрыть предпросмотр'}).click();
   await page.getByRole('button',{name:'Сохранённое',exact:true}).click();
   const row=page.locator('.production-map-saved-row.route').filter({hasText:walk.title});await row.getByRole('button',{name:'Открыть',exact:true}).click();
   await page.getByRole('button',{name:'Скачать GPX',exact:true}).waitFor();
   const canonical=await page.evaluate(petId=>JSON.parse(localStorage.getItem(`pso.map.active-route.v3:${petId}`)),pet.id);assert.equal(canonical.editingRouteId,saved.id);assert.deepEqual(canonical.points,walk.path);assert.equal(canonical.planning.stops[1].title,'Пруд');
   // A different unfinished route from local recovery may not be replaced by this proposal.
   const key=`pso.map.active-route.v3:${pet.id}`,original=[[37.60,55.75],[37.601,55.751]];
   await page.evaluate(({key,petId,points})=>localStorage.setItem(key,JSON.stringify({version:3,petId,flow:'planning',elapsedSeconds:0,points,updatedAt:Date.now(),title:'Моя прогулка',note:'Сохранить исходное',planning:{version:1,mode:'manual',stops:points.map(point=>({point}))}})),{key,petId:pet.id,points:original});
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();dialog=await open();await dialog.getByRole('button',{name:'Посмотреть прогулку'}).click();await preview.waitFor();
   assert.equal(await preview.getByRole('button',{name:'Использовать этот путь'}).isDisabled(),true);
   const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.deepEqual(restored.points,original);assert.equal(restored.note,'Сохранить исходное');
   await page.screenshot({path:`${out}/agent-walk-existing-${engine}-${width}.png`});
   await preview.getByRole('button',{name:'Закрыть предпросмотр'}).click();await page.locator('[data-route-controller]').waitFor();assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).title,'Моя прогулка');assert.deepEqual(t.errors,[]);
   results.push({engine,width,pass:true,scope:'real frontend; mocked agent/route APIs; no live routing or cloud save claim'});console.log(`PASS ${engine}/${width}: preview, snaps, private save failure/retry, proposal reload, existing draft preservation`);
  }catch(e){console.log(await page.locator('body').innerText());throw e;}finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/agent-walk-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
