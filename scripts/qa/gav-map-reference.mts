import { chromium,webkit,type Route } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {applyLibraryCommand,emptyMapLibrary} from '../../lib/mapLibrary';
const base=process.env.BASE_URL||'http://127.0.0.1:3253';
const out=process.env.OUT_DIR||'docs/gav-map-reference-release/evidence';await fs.mkdir(out,{recursive:true});
const report=[];
const pet={id:'ref-test-pet',name:'Бим',owner_id:'ref-test-owner'};
const profile={dogName:'Бим',backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',size:'средняя',vaccineStatus:'актуально',parasiteStatus:'актуально',socialMode:'сначала спросить',energyLevel:'обычный',neighborhood:'Сокол',photos:[],selectedStyle:'city'};
for(const engine of (process.env.ENGINE?[process.env.ENGINE]:['chromium','webkit'])){
 const browser=await({chromium,webkit}[engine as 'chromium'|'webkit']).launch();
 try{for(const width of (process.env.WIDTH?[+process.env.WIDTH]:[320,390,1280])){
 const context=await browser.newContext({viewport:{width,height:width===1280?720:width===320?740:844},reducedMotion:'reduce'});
 await context.addInitScript(({profile})=>{Object.defineProperty(window,'Telegram',{configurable:false,value:{WebApp:{initData:'reference-fixture',ready(){},expand(){},enableClosingConfirmation(){}}}});localStorage.setItem('pso.topapp.onboarding.v1','done');localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));},{profile});
 const page=await context.newPage();page.setDefaultTimeout(18000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const json=(r:Route,b:unknown,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(b)});
 await page.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/api/v1/session/telegram',r=>json(r,{mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:pet.name}}));
 await page.route('**/api/app/bootstrap**',r=>json(r,{mode:'owner',connected:true,pet,pets:[pet],profile,activePetId:pet.id,reminders:[],wishlist:[],zones:[],routes:[],observations:[],documents:[]}));
 await page.route('**/api/map/features**',r=>json(r,{features:[]}));
 const dimensions=[[400,800],[1000,400],[500,500],[2000,100],[100,2000]];
 await page.route('**/qa-photo-*',r=>{const id=+(r.request().url().split('qa-photo-')[1]);if(id===6)return r.fulfill({status:404});const [w,h]=dimensions[id]||dimensions[0];return r.fulfill({status:200,contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#98bad6"/><rect x="3" y="3" width="${w-6}" height="${h-6}" fill="none" stroke="#2a4369" stroke-width="6"/><text x="${w/2}" y="${h/2}" font-size="${Math.min(w,h)/8}" text-anchor="middle">${w} × ${h}</text></svg>`});});
 const candidates=Array.from({length:7},(_,i)=>({petId:'c'+i,name:i===2?'Собака с очень длинным именем для проверки переноса':'Собака '+i,avatarUrl:i===5?null:base+'/qa-photo-'+i,lifeStage:'adult',weightKg:15,temperament:'calm',energyLevel:'balanced',dogFriendly:'friendly',playStyle:'мягко',city:'moscow',district:'Сокол',scenarios:['meet','walk','socialize','mating'],sharedScenarios:['walk','meet','socialize','mating'],distance:'до 5 км',reasons:['Спокойный ритм','Любит прогулки'],contactVisibility:'hidden_until_mutual_consent'}));
 let requests=0,failRequest=true;const posted:unknown[]=[];
 await page.route('**/api/social/profile**',r=>json(r,{profile:{petId:pet.id,discoverable:true,city:'moscow',district:'Сокол',coarseLocation:{lat:55.744,lng:37.603},scenarios:['meet','walk','socialize','mating']}}));
 await page.route('**/api/social/candidates**',r=>json(r,{nearby:candidates,city:[]}));
 await page.route('**/api/social/signals**',r=>json(r,{signals:[],viewer:{approximateLocation:{lat:55.744,lng:37.603},radiusMeters:3000}}));
 await page.route('**/api/social/requests**',r=>{if(r.request().method()==='POST'){requests++;posted.push(r.request().postDataJSON());if(failRequest){failRequest=false;return json(r,{error:'TEST_FAILURE'},503);}return json(r,{request:{id:'r1',status:'pending'}});}return json(r,{requests:[]});});
 let library=emptyMapLibrary();for(const [id,title,lng,lat] of [['p1','Сад у набережной',37.61,55.75],['p2','У пруда',37.615,55.753],['p3','Дальняя площадка',30.32,59.93]] as const)library=applyLibraryCommand(library,{id:'seed-'+id,kind:'savePlace',collectionId:'saved',place:{id,title,detail:'Проверочное место',category:'парк',point:{lng,lat},source:{provider:'pso',id},note:''}});
 let failSave=true,saveCalls=0,catalogCalls=0;
 await page.route('**/api/map/library**',r=>{if(r.request().method()==='POST'){saveCalls++;if(failSave){failSave=false;return json(r,{error:'TEST_FAILURE'},503);}library=applyLibraryCommand(library,r.request().postDataJSON().command);}return json(r,{library});});
 await page.route('**/api/map/places?**',r=>{catalogCalls++;return json(r,{error:'AREA_NOT_COVERED'},422);});
 await page.route('**/api/map/search**',r=>json(r,{results:[{id:'osm:test',title:'Найденный парк',kind:'organization',category:'парк',detail:'Результат проверки',point:{lat:55.751,lng:37.614}}]}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.app-tabs button[data-route="nearby"]').click();await page.getByRole('button',{name:'Знакомства',exact:true}).click();await page.locator('.gav-deck-card').waitFor();await page.locator('.gav-photo[data-photo-state="ready"]').waitFor();
 async function swipe(dx:number,dy=0){const p=page.locator('.gav-photo');await p.scrollIntoViewIfNeeded();const b=await p.boundingBox();assert(b);const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();}
 await swipe(-100);await page.getByRole('heading',{name:'Собака 1',exact:true}).waitFor();assert.equal(requests,0);await swipe(100);await page.getByRole('heading',{name:'Собака 0',exact:true}).waitFor();await swipe(15,90);assert.equal(await page.locator('.gav-card-heading h2').innerText(),'Собака 0');await swipe(25);assert.equal(await page.locator('.gav-card-heading h2').innerText(),'Собака 0');
 await page.locator('.gav-deck-card').dispatchEvent('pointercancel',{pointerId:1,pointerType:'touch'});assert.equal(await page.locator('.gav-card-heading h2').innerText(),'Собака 0');
 for(let i=0;i<7;i++){
  if(i)await page.getByRole('button',{name:'Следующая анкета',exact:true}).click();
  if(i<5){await page.locator('.gav-photo[data-photo-state="ready"]').waitFor();const frame=await page.locator('.gav-photo').boundingBox();assert(frame);assert(Math.abs(frame.width/frame.height-4/3)<.02);assert.equal(await page.locator('.gav-photo img').evaluate(el=>getComputedStyle(el).objectFit),'contain');}
  else await page.locator('.gav-photo-fallback').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390&&i<3){await page.locator('.production-woof-workspace').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${out}/photo-${i}-${engine}-${width}.png`});}
 }
 assert.equal(requests,0);assert.equal(await page.getByRole('button',{name:'Следующая анкета',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Предыдущая анкета',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Собака 5',exact:true}).waitFor();
 await page.getByRole('button',{name:'Сейчас рядом',exact:true}).click();await page.getByRole('button',{name:'Знакомства',exact:true}).click();await page.getByRole('heading',{name:'Собака 5',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs button[data-route="nearby"]').click();await page.getByRole('button',{name:'Знакомства',exact:true}).click();await page.getByRole('heading',{name:'Собака 5',exact:true}).waitFor();
 await page.getByRole('button',{name:'Откликнуться',exact:true}).click();await page.locator('.woof-action-error').waitFor();assert.equal(requests,1);await page.getByRole('button',{name:'Откликнуться',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('.woof-action-result'));assert.equal(requests,2);
 await page.locator('.app-tabs button[data-route="map"]').click();await page.locator('.map-place-row').first().waitFor();assert.equal(catalogCalls,0);
 await page.locator('[data-place-id="p1"]').click();await page.locator('.map-linked-places .map-place-panel').waitFor();assert.equal(await page.locator('.map-linked-places>li.is-selected').count(),1);
 await page.locator('.map-linked-places .map-place-panel').getByRole('button',{name:'Добавить в прогулку',exact:true}).click();await page.locator('.map-resume-draft').filter({hasText:'1 точка'}).waitFor();
 await page.locator('[data-place-id="p2"]').click();await page.locator('.map-linked-places .map-place-panel').getByRole('button',{name:'Добавить в прогулку',exact:true}).click();await page.locator('.map-resume-draft').filter({hasText:'2 точки'}).waitFor();
 await page.locator('[data-place-id="p1"]').click();await page.locator('.map-linked-places .map-place-panel').getByRole('button',{name:'Добавить в прогулку',exact:true}).click();assert.match(await page.locator('.map-resume-draft').innerText(),/2 точки/);
 await page.locator('.production-map-search input').fill('Найденный парк');await page.locator('.production-map-search').getByRole('button',{name:'Найти',exact:true}).click();await page.getByRole('option').filter({hasText:'Найденный парк'}).click();
 const chosen=page.locator('.map-place-panel').filter({visible:true});await chosen.getByRole('button',{name:'Сохранить место',exact:true}).click();await chosen.getByRole('alert').waitFor();assert(!library.places.some(p=>p.source.id==='osm:test'));
 await chosen.getByRole('button',{name:'Сохранить место',exact:true}).click();await chosen.getByRole('status').filter({hasText:'Сохранено'}).waitFor();assert(library.places.some(p=>p.source.id==='osm:test'));
 await chosen.getByRole('button',{name:'Сохранить место',exact:true}).click();await chosen.getByRole('status').filter({hasText:'Уже сохранено'}).waitFor();assert.equal(library.places.filter(p=>p.source.id==='osm:test').length,1);assert.equal(await page.locator('.map-place-row').count(),1);
 await page.locator('.map-surface-overlay').waitFor({state:'hidden',timeout:45000});await page.locator('.production-map-workspace').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${out}/places-${engine}-${width}.png`});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs button[data-route="map"]').click();await page.getByRole('button',{name:'Сохранённое',exact:true}).click();await page.locator('.map-library-places').getByRole('button',{name:/Найденный парк/}).waitFor();assert.equal(catalogCalls,0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 report.push({engine,width,swipeNoSends:true,photoRatios:5,missingAndBroken:true,keyboard:true,modeReturn:true,responseFailureRetry:true,requests,saveCalls,appendNonempty:true,dedup:true,saveFailureRetryReopen:true,noOfflineCatalog:true});console.log(engine,width,'PASS');await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(`${out}/verification.json`,JSON.stringify({fixture:true,report},null,2));
