import { chromium,webkit,type Route } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:3253';
const out=process.env.OUT_DIR||'docs/gav-welcome-entry/evidence';await fs.mkdir(out,{recursive:true});
const report=[];
const pet={id:'ref-test-pet',name:'Бим',owner_id:'ref-test-owner'};
const profile={dogName:'Пуня',backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',size:'средняя',vaccineStatus:'актуально',parasiteStatus:'актуально',socialMode:'сначала спросить',energyLevel:'обычный',neighborhood:'Сокол',photos:[],selectedStyle:'city'};
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

 let geoCalls=0;await page.exposeFunction('recordGeo',()=>geoCalls++);
 await context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_success:unknown,error:(e:unknown)=>void){void (window as unknown as {recordGeo:()=>void}).recordGeo();setTimeout(()=>error({code:1,message:'Denied'}),0);}}});});
 let failSearch=true;let searchCalls=0;
 await page.route('**/api/social/profile**',r=>json(r,{profile:{petId:pet.id,discoverable:true,city:'moscow',district:'',scenarios:['meet','walk']}}));
 await page.route('**/api/social/candidates**',r=>json(r,{nearby:[],city:[]}));
 await page.route('**/api/social/requests**',r=>json(r,{requests:[]}));
 await page.route('**/api/social/signals**',r=>{const u=new URL(r.request().url());return u.searchParams.has('lat')?json(r,{signals:[],viewer:{approximateLocation:{lat:55.8,lng:37.5},radiusMeters:3000}}):json(r,{error:'VIEWER_LOCATION_REQUIRED'},409);});
 await page.route('**/api/map/search**',r=>{searchCalls++;if(failSearch){failSearch=false;return json(r,{error:'TEST_FAILURE'},503);}return json(r,{results:[{id:'test-area',title:'Сокол, Москва',kind:'organization',point:{lat:55.8,lng:37.5}}]});});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.app-tabs button[data-route="nearby"]').click();await page.locator('.woof-welcome').waitFor();await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 assert.equal(geoCalls,0);assert.equal(await page.locator('.woof-live-filter-disclosure').count(),0);assert.equal(await page.locator('.woof-map-layer').isVisible(),false);assert.equal(await page.getByText('Укажите область поиска',{exact:true}).count(),0);
 const manual=page.getByRole('button',{name:'Указать район',exact:true});const nav=await page.locator('.app-tabs').boundingBox(),mb=await manual.boundingBox();assert(nav&&mb&&(mb.y+mb.height<=nav.y||mb.x>=nav.x+nav.width||mb.x+mb.width<=nav.x),'manual choice initially above nav');
 await page.screenshot({path:`${out}/welcome-${engine}-${width}.png`});
 if(width===320){const zoom=await page.addStyleTag({content:'.woof-welcome h1{font-size:52px!important}.woof-welcome>p,.woof-welcome button{font-size:32px!important}'});await manual.click();await page.getByRole('button',{name:'Назад',exact:true}).click();await zoom.evaluate(e=>e.remove());}
 await page.getByRole('button',{name:'Найти рядом со мной',exact:true}).click();await page.locator('.woof-welcome').getByRole('alert').waitFor();assert.equal(geoCalls,1);assert(await manual.isVisible());
 await manual.click();const input=page.getByLabel('Город, район или место',{exact:true});await input.fill('Сокол');await page.getByRole('button',{name:'Назад',exact:true}).click();await manual.click();assert.equal(await input.inputValue(),'Сокол');await input.press('Enter');await page.getByRole('status').filter({hasText:'Поиск не ответил'}).waitFor();assert.equal(await input.inputValue(),'Сокол');await page.getByRole('button',{name:'Найти район',exact:true}).click();await page.getByRole('button',{name:'Сокол, Москва',exact:true}).waitFor();assert.equal(searchCalls,2);
 const intro=await page.locator('.woof-welcome>p').first().boundingBox(),form=await page.locator('.woof-manual-area').boundingBox();assert(intro&&form&&form.y>=intro.y+intro.height,'manual form stays below introduction');
 await page.screenshot({path:`${out}/manual-${engine}-${width}.png`});await page.getByRole('button',{name:'Сокол, Москва',exact:true}).click();await page.locator('.woof-live-map').waitFor();assert.equal(await page.locator('.woof-welcome').count(),0);assert.equal(await page.locator('.woof-live-filter-disclosure').count(),1);
 await page.getByRole('button',{name:'Знакомства',exact:true}).click();await page.getByRole('button',{name:'Сейчас рядом',exact:true}).click();await page.locator('.woof-live-map').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);report.push({engine,width,noImplicitGPS:true,oneEntry:true,noBlankMap:true,deniedGPSToManual:true,backPreservesInput:true,searchRetry:true,selectedAreaRestoresMap:true});console.log(engine,width,'PASS');await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(out+'/verification.json',JSON.stringify(report,null,2));
