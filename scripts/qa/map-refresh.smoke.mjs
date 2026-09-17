import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.APP_URL||'http://localhost:4331',out=process.env.OUT_DIR||'/tmp/pso-map-smoke';await mkdir(out,{recursive:true});const results=[];
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(18000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(base+'/?demo=1',{waitUntil:'domcontentloaded'});await p.locator('[data-route="map"]').click();const map=p.locator('.map-refresh .leaflet-container');await map.waitFor();
   await p.evaluate(()=>document.fonts.ready);assert((await map.boundingBox()).height>450);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.match(await p.locator('#production-map-search-input').evaluate(e=>getComputedStyle(e).fontFamily),/Naris/);
   await p.screenshot({path:`${out}/${engine}-${width}-map.png`});
   await p.getByRole('button',{name:'Маршрут',exact:true}).click();await p.getByRole('button',{name:'Вручную',exact:true}).click();
   await map.click({position:{x:120,y:145}});await p.getByRole('button',{name:'Добавить остановку',exact:true}).click();
   await map.click({position:{x:220,y:190}});await p.getByRole('button',{name:'Добавить остановку',exact:true}).click();
   await p.getByRole('button',{name:'Отметить',exact:true}).click();await p.getByText('Войди в Псё, чтобы поставить отметку.').waitFor();
   await p.getByRole('button',{name:'Закрыть панель',exact:true}).click();await p.getByRole('button',{name:'Моя прогулка',exact:true}).click();assert.equal(await p.locator('.map-waypoint-list li').count(),2);
   await p.getByRole('button',{name:'Готово',exact:true}).click();await p.getByPlaceholder('Например, вечерний круг').fill('Проверочная прогулка');
   await p.getByRole('button',{name:'Сохранить лично',exact:true}).click();await p.locator('[data-route-flow="idle"]').waitFor();
   await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-route="map"]').click();await p.getByRole('button',{name:'Сохранённое',exact:true}).click();await p.getByText('Проверочная прогулка',{exact:true}).waitFor();
   const route=p.locator('.production-map-saved-row.route').filter({hasText:'Проверочная прогулка'});await route.getByRole('button',{name:'Открыть',exact:true}).click();await p.getByRole('button',{name:'Скачать GPX',exact:true}).waitFor();
   await p.screenshot({path:`${out}/${engine}-${width}-route.png`});
   await p.getByRole('button',{name:'Закрыть панель',exact:true}).click();await p.getByRole('button',{name:'Мы гуляем',exact:true}).click();assert.equal(await p.locator('.map-refresh-panel textarea').count(),0);await p.getByText('Войди в Псё, чтобы поставить отметку.').waitFor();
   await p.getByRole('button',{name:'Закрыть панель',exact:true}).click();
   await p.route('**/api/map/search?**',route=>route.fulfill({json:{results:[{id:'osm-way-1',title:'Казанский кремль',detail:'Казань',category:'место',kind:'organization',point:{lat:55.8,lng:49.1},dogAccess:'unknown',pointIsCenter:true,sourceUrl:'https://www.openstreetmap.org/way/1'}]}}));
   await p.getByPlaceholder('Место или адрес').fill('Казанский кремль');await p.getByRole('button',{name:'Найти',exact:true}).click();await p.getByRole('option',{name:/Казанский кремль/}).click();await p.getByRole('heading',{name:'Казанский кремль',exact:true}).waitFor();
   await p.getByRole('button',{name:'Сохранить место',exact:true}).click();await p.getByRole('button',{name:'Закрыть панель',exact:true}).click();await p.getByRole('button',{name:'Сохранённое',exact:true}).click();await p.locator('.map-library-places').getByText('Казанский кремль',{exact:true}).waitFor();
   await p.locator('[data-route="profile"]').click();assert.notEqual(await p.locator('#pso-exact-content').evaluate(e=>getComputedStyle(e).overflow),'hidden');
   assert.deepEqual(errors,[]);results.push({engine,width,status:'pass',scenarios:['map','manual route','hazard preserves draft','save/reopen/GPX','profile pin without questionnaire','search/save place','global typography/navigation']});
  }catch(e){await p.screenshot({path:`${out}/${engine}-${width}-failure.png`});await writeFile(`${out}/failure.txt`,await p.locator('body').innerText());throw e;}finally{await context.close();}
 }
 await browser.close();
}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
