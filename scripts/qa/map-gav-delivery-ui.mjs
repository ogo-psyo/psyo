import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:3231';const out='docs/map-gav-20260907/screens';await mkdir(out,{recursive:true});
const results=[];
for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true});
 try{for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:width===1280?720:844}});
  await context.addInitScript(()=>{
   let watcher=null;let point={latitude:55.744,longitude:37.603,accuracy:5};
   window.__gps=(latitude,longitude)=>{point={latitude,longitude,accuracy:5};watcher?.({coords:point,timestamp:Date.now()});};
   Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(ok){ok({coords:point,timestamp:Date.now()});},watchPosition(ok){watcher=ok;setTimeout(()=>ok({coords:point,timestamp:Date.now()}),50);return 1;},clearWatch(){watcher=null;}}});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text().slice(0,1200));});
  let searches=0;await page.route('**/api/map/search**',route=>{searches++;return route.fulfill({json:{results:[{id:'osm-way-100',title:'Тестовый парк',detail:'Обезличенный пример',category:'парк',kind:'organization',point:{lat:55.744,lng:37.603}}]}});});
  await page.goto(`${base}/?demo=1`,{waitUntil:'domcontentloaded'});
  await page.locator('.app-tabs button[data-route="map"]').click();
  const workspace=page.locator('[data-production-map-workspace]');await workspace.waitFor();await page.locator('.leaflet-container').waitFor();
  await page.getByRole('button',{name:'Начать прогулку',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-production-map-workspace]')?.getAttribute('data-route-flow')==='recording');
  await page.waitForTimeout(150);await page.evaluate(()=>window.__gps(55.7443,37.6033));await page.waitForTimeout(150);
  await page.getByRole('button',{name:'Свернуть маршрут',exact:true}).click();
  await page.locator('.app-tabs button[data-route="today"]').click().catch(async e=>{await page.screenshot({path:'/tmp/pso-map-failure.png'});console.log('PORTAL',await page.locator('nextjs-portal').allTextContents());throw e;});
  await page.getByRole('button',{name:/Прогулка записывается · Вернуться/}).waitFor();
  assert.equal(await page.locator('.phone-shell.journal-shell').evaluate(el=>getComputedStyle(el).overflowY),'auto','content remains scrollable after first map visit');
  await page.locator('.phone-shell.journal-shell').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.screenshot({path:`${out}/home-after-map-${engine}-${width}.png`});
  await page.getByRole('button',{name:/Прогулка записывается · Вернуться/}).click();
  await page.locator('.map-resume-draft button').click();await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.waitForTimeout(150);
  await page.evaluate(()=>window.__gps(55.745,37.604));await page.waitForTimeout(150);
  await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('button',{name:'Завершить',exact:true}).click();
  await page.getByText('В записи есть перерывы GPS.',{exact:false}).waitFor();
  await page.locator('[data-map-composer-content] input').fill('Тестовый круг');
  if(width===390){await page.screenshot({path:`${out}/route-${engine}-390.png`});const style=await page.addStyleTag({content:await readFile('docs/map-gav-20260907/visual-b.css','utf8')});await page.screenshot({path:`${out}/route-${engine}-390-b.png`});await style.evaluate(el=>el.remove());}
  await page.getByRole('button',{name:'Сохранить лично',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-production-map-workspace]')?.getAttribute('data-route-flow')==='idle');
  await page.locator('[data-route-action="plan"]').click();await page.getByRole('button',{name:'Добавить точку',exact:true}).click();
  await page.getByRole('button',{name:'Добавить точку',exact:true}).click();
  await page.getByRole('button',{name:'Свернуть маршрут',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.map-resume-draft button').waitFor();assert.equal(await page.locator('[data-route-controller]').count(),0,'restored draft must not force the editor');
  await page.locator('.map-resume-draft button').click();
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.getByRole('button',{name:'Удалить черновик',exact:true}).click();
  const search=page.locator('#production-map-search-input');await search.fill('Тестовый парк');assert.equal(searches,0,'typing must not send provider requests');
  await page.getByRole('button',{name:'Найти',exact:true}).click();await page.getByRole('option',{name:/Тестовый парк/}).click();
  await page.getByRole('button',{name:'Сохранить место',exact:true}).click();await page.getByText('Сохранено в «Сохранённые места»').waitFor();
  await page.locator('.map-place-panel').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:`${out}/place-${engine}-${width}.png`});
  if(width===390){const style=await page.addStyleTag({content:await readFile('docs/map-gav-20260907/visual-b.css','utf8')});await page.screenshot({path:`${out}/place-${engine}-${width}-b.png`});await style.evaluate(el=>el.remove());}
  await page.getByRole('button',{name:'К результатам',exact:true}).click();assert.equal(await search.inputValue(),'Тестовый парк','return preserves the search query');
  await search.press('Escape');await page.getByRole('button',{name:/Сохранённое на карте/}).click().catch(async e=>{await page.screenshot({path:'/tmp/pso-map-collections-failure.png'});console.log('AFTER ESCAPE',await page.locator('main').allTextContents());throw e;});
  await page.getByLabel('Название подборки',{exact:true}).fill('Парки');await page.getByRole('button',{name:'Создать',exact:true}).click();
  await page.getByLabel('Открыть подборку',{exact:true}).selectOption('saved');
  await page.getByLabel('Добавить также в',{exact:true}).selectOption({label:'Парки'});
  await page.getByRole('button',{name:'Убрать из подборки',exact:true}).click();await page.getByLabel('Открыть подборку',{exact:true}).selectOption({label:'Парки · 1'});
  await page.locator('.map-library-places').getByRole('button',{name:/Тестовый парк/}).waitFor();
  await page.screenshot({path:`${out}/collections-${engine}-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no page overflow');assert.deepEqual(errors,[]);
  results.push({engine,width,result:'pass',scenarios:['GPS fold/navigation/gap/save','optional draft recovery','search submit and return','multi-collection membership']});await context.close();
 }}finally{await browser.close();}
}
console.log(JSON.stringify(results,null,2));
