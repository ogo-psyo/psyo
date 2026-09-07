import { chromium, webkit, type Route } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { applyLibraryCommand, emptyMapLibrary } from '../../lib/mapLibrary';
const base=process.env.BASE_URL||'http://127.0.0.1:3237';
const out=process.env.OUT_DIR||'docs/map-place-value/evidence';await fs.mkdir(out,{recursive:true});
const results=[];
for(const engine of (process.env.ENGINE?[process.env.ENGINE]:['chromium','webkit'])){
 const browser=await({chromium,webkit}[engine as 'chromium'|'webkit']).launch();
 try{for(const width of (process.env.WIDTH?[+process.env.WIDTH]:[320,390,1280])){
 const context=await browser.newContext({viewport:{width,height:width===1280?720:844},reducedMotion:'reduce'});
 const pet={id:'place-test-pet',name:'Мята',owner_id:'place-test-owner'};
 const profile={dogName:pet.name,backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',size:'средняя',vaccineStatus:'актуально',parasiteStatus:'актуально',socialMode:'сначала спросить',energyLevel:'обычный',neighborhood:'Сокол',photos:[],selectedStyle:'city'};
 await context.addInitScript(({profile})=>{Object.defineProperty(window,'Telegram',{configurable:false,value:{WebApp:{initData:'place-value-fixture',ready(){},expand(){},enableClosingConfirmation(){}}}});localStorage.setItem('pso.topapp.onboarding.v1','done');localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));},{profile});
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const json=(r:Route,b:unknown,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(b)});
 await page.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/api/v1/session/telegram',r=>json(r,{mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:pet.name}}));
 await page.route('**/api/app/bootstrap**',r=>json(r,{mode:'owner',connected:true,pet,pets:[pet],profile,activePetId:pet.id,reminders:[],wishlist:[],zones:[],routes:[],observations:[],documents:[]}));
 await page.route('**/api/map/features**',r=>json(r,{features:[]}));
 await page.route('**/api/social/**',r=>json(r,{signals:[],requests:[],profile:null,candidates:[]}));
 let library=emptyMapLibrary(),failSave=true,saves=0,failPlaces=false,requests=0,slowPlaces=false;
 const place={id:'osm-node-test-1',title:'Контрольный парк',detail:'Тестовый адрес',category:'парк',group:'parks',point:{lat:55.75,lng:37.615}};
 await page.route('**/api/map/places?**',async r=>{requests++;if(failPlaces){failPlaces=false;return json(r,{error:'unavailable'},503);}const url=new URL(r.request().url());const category=url.searchParams.get('category');if(slowPlaces&&category==='parks')await new Promise(resolve=>setTimeout(resolve,300));const [south,west,north,east]=url.searchParams.get('bounds')!.split(',').map(Number);return json(r,{results:category==='vets'?[]:[place],bounds:{south,west,north,east},category,total:category==='vets'?0:1,truncated:false,source:'OpenStreetMap',updatedAt:'2026-09-07',coverage:[{id:'fixture',title:'Тестовая область'}]});});
 await page.route('**/api/map/library**',r=>{if(r.request().method()==='POST'){saves++;if(failSave){failSave=false;return json(r,{error:'TEST_FAILURE'},503);}library=applyLibraryCommand(library,r.request().postDataJSON().command);}return json(r,{library});});
 await page.goto(base,{waitUntil:'commit'});await page.locator('.app-tabs button[data-route="map"]').click();
 await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('parks');await page.locator('[data-place-id]').first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Найти место или адрес',exact:true}).count(),0);
 await page.locator('.map-surface-overlay').waitFor({state:'hidden',timeout:45000});
 await page.screenshot({path:`${out}/places-${engine}-${width}.png`});
 await page.locator('[data-place-id]').first().click();await page.locator('.map-place-panel').waitFor();
 await page.getByRole('button',{name:'Сохранить место',exact:true}).click();await page.locator('.map-place-panel [role="alert"]').waitFor();assert.equal(library.places.length,0);
 await page.getByRole('button',{name:'Сохранить место',exact:true}).click();await page.locator('.map-place-panel [role="status"]').filter({hasText:'Сохранено'}).waitFor();assert.equal(library.places.length,1);
 await page.getByRole('button',{name:'Сохранить место',exact:true}).click();await page.locator('.map-place-panel [role="status"]').filter({hasText:'Уже сохранено'}).waitFor();assert.equal(library.places.length,1);assert.equal(library.collections[0].placeIds.length,1);
 await page.getByRole('button',{name:'К местам',exact:true}).click();assert.equal(await page.locator('[data-place-id]').first().evaluate(el=>document.activeElement===el),true);
 await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('vets');await page.getByRole('status').filter({hasText:'нет мест выбранного типа'}).waitFor();assert.equal(await page.locator('[data-place-id]').count(),0);
 slowPlaces=true;await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('parks');await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('vets');await page.waitForTimeout(500);assert.equal(await page.getByRole('combobox',{name:'Тип места',exact:true}).inputValue(),'vets');assert.equal(await page.locator('[data-place-id]').count(),0);slowPlaces=false;
 failPlaces=true;await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('parks');await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await page.locator('[data-place-id]').first().waitFor();
 await page.reload({waitUntil:'commit'});await page.locator('.app-tabs button[data-route="map"]').click();await page.getByRole('button',{name:'Сохранённое',exact:true}).click();
 await page.locator('.map-library-places').getByRole('button',{name:'Контрольный парк Тестовый адрес',exact:true}).click();await page.locator('.map-place-panel').waitFor();await page.screenshot({path:`${out}/reopened-${engine}-${width}.png`});
 await page.getByRole('button',{name:'К подборке',exact:true}).click();await page.locator('.map-library-places input[type="checkbox"]').first().check();
 await page.getByRole('button',{name:'Собрать прогулку · 1',exact:true}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.locator('.map-waypoint-list li').waitFor();assert.match(await page.locator('.map-waypoint-list').innerText(),/Контрольный парк/);
 await page.reload({waitUntil:'commit'});await page.locator('.app-tabs button[data-route="map"]').click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();assert.match(await page.locator('.map-waypoint-list').innerText(),/Контрольный парк/);
 await page.screenshot({path:`${out}/route-${engine}-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);results.push({engine,width,requests,saves,accountFixtureSaveRetryDedup:true,reopen:true,collectionToNamedStops:true,draftReload:true,emptyAndFailure:true,staleResponseGuard:true,focusReturn:true});console.log(engine,width,'PASS');
 await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(`${out}/ui.json`,JSON.stringify({fixture:true,results},null,2));
