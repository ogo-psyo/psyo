import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { applyLibraryCommand, emptyMapLibrary } from '../../lib/mapLibrary.ts';
import fs from 'node:fs/promises';
const out=process.env.OUT_DIR||'docs/gav-complete-journey/evidence/';await fs.mkdir(out,{recursive:true});
const base=process.env.BASE_URL||'http://localhost:3258';
const browser=await (process.env.ENGINE==='webkit'?webkit:chromium).launch();
let failSignal=false, failProfile=true, failResponse=true, failLibrary=true;
let request=null,signal=null,proposals=[],failSend=false,failAccept=false,failMeeting=false,delayMeeting=0;
const shots=[];
const place={id:'audit-place',title:'Вход в парк',detail:'Демонстрационное место',category:'парк',point:{lat:55.76,lng:37.62},source:{provider:'user',id:'audit-place'},note:''};
const preview={kind:'place',sourceId:place.id,title:place.title,detail:place.detail,points:[[37.62,55.76]]};
const names={a:'Мята',b:'Луна'};
const json=(r,b,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(b)});
async function user(id){
 const pet={id:'pet-'+id,name:names[id],owner_id:'owner-'+id};
 const profile={dogName:pet.name,backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',size:'средняя',vaccineStatus:'актуально',parasiteStatus:'актуально',socialMode:'сначала спросить',energyLevel:'обычный',neighborhood:'Сокол',photos:[],selectedStyle:'city'};
 let library=emptyMapLibrary();
 const s={viewer:{lat:55.76,lng:37.62},peers:false,signalError:false,library:false,hasProfile:false,hasArea:false,search:'ready',noContact:false};
 const ctx=await browser.newContext({viewport:{width:Number(process.env.WIDTH)||390,height:Number(process.env.HEIGHT)||720},geolocation:{latitude:55.76,longitude:37.62},permissions:['geolocation'],reducedMotion:'reduce'});
 await ctx.addInitScript(({profile})=>{
 window.__chatAttempts=[];
 Object.defineProperty(window,'Telegram',{configurable:false,value:{WebApp:{initData:'audit-fixture-only',ready(){},expand(){},enableClosingConfirmation(){},openTelegramLink(url){window.__chatAttempts.push(url)}}}});
 localStorage.setItem('pso.topapp.onboarding.v1','done');localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));
 },{profile});
 if(process.env.NO_GPU==='1')await ctx.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl|experimental-webgl/.test(kind)?null:original.call(this,kind,...args);};});
 const p=await ctx.newPage();p.setDefaultTimeout(15000);
 await p.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 if(process.env.BLOCK_MAP==='1')await p.route('https://tiles.openfreemap.org/**',r=>r.abort());
 await p.route('**/api/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname,m=r.request().method();
  if(path==='/api/v1/session/telegram')return json(r,{mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:pet.name}});
  if(path==='/api/app/bootstrap')return json(r,{mode:'owner',connected:true,pet,pets:[pet],profile,activePetId:pet.id,reminders:[],wishlist:[],zones:[],routes:[],observations:[],documents:[]});
  if(path==='/api/social/profile'){
   if(m==='PUT'){if(failProfile){failProfile=false;return json(r,{error:'TEST_FAILURE'},503);}s.hasProfile=true;}
   return json(r,{profile:s.hasProfile?{petId:pet.id,discoverable:true,city:'moscow',district:'Сокол',coarseLocation:{lat:55.76,lng:37.62},scenarios:['walk','meet']}:null});
  }
  if(path==='/api/social/candidates')return s.hasProfile?json(r,{nearby:request&&['pending','accepted'].includes(request.status)?[]:[{petId:id==='a'?'pet-b':'pet-a',name:id==='a'?'Луна':'Мята',avatarUrl:null,lifeStage:'adult',weightKg:15,temperament:'calm',energyLevel:'balanced',dogFriendly:'friendly',playStyle:'мягко',city:'moscow',district:'Сокол',scenarios:['walk','meet'],sharedScenarios:['walk','meet'],distance:'до 5 км',reasons:['Спокойный ритм','Любит прогулки'],contactVisibility:'hidden_until_mutual_consent'}],city:[]}):json(r,{error:'DISCOVERY_NOT_ENABLED'},409);
  if(path==='/api/social/signals'){
   if(s.signalError)return json(r,{error:'TEST_FAILURE'},503);
   if(m==='DELETE'){signal=null;return json(r,{signal:null});}
   if(m==='PUT'){if(failSignal){failSignal=false;return json(r,{error:'TEST_FAILURE'},503);}const b=r.request().postDataJSON();signal={id:'signal-a',petId:pet.id,name:pet.name,avatarUrl:null,city:'moscow',district:'Сокол',approximateLocation:b.coarseLocation,privacyRadiusMeters:700,startsAt:b.startsAt,expiresAt:new Date(Date.now()+7200000).toISOString(),pace:b.pace,note:b.note,temperament:'calm',dogFriendly:'friendly',contactVisibility:'hidden_until_mutual_consent'};return json(r,{signal},201);}
   if(!s.hasArea&&!u.searchParams.has('lat'))return json(r,{error:'VIEWER_LOCATION_REQUIRED'},409);
   s.hasArea=true;if(u.searchParams.has('lat'))s.viewer={lat:Number(u.searchParams.get('lat')),lng:Number(u.searchParams.get('lng'))};return json(r,{signals:signal?[{...signal,isMine:signal.petId===pet.id},...(s.peers?[{...signal,id:'peer',petId:'pet-peer',name:'Луна',isMine:false,approximateLocation:{lat:s.viewer.lat+.001,lng:s.viewer.lng+.001}}]:[])]:[],viewer:{approximateLocation:s.viewer,radiusMeters:Number(u.searchParams.get('radiusKm')||3)*1000,city:'moscow'}});
  }
  if(path==='/api/map/search'){if(s.search==='error')return json(r,{error:'TEST_FAILURE'},503);return json(r,{results:s.search==='empty'?[]:[{id:'audit-area',title:'Сокол, Москва',kind:'organization',point:{lat:55.76,lng:37.62}}]});}
  if(path==='/api/map/library'){if(m==='POST'){if(failLibrary){failLibrary=false;return json(r,{error:'TEST_FAILURE'},503);}library=applyLibraryCommand(library,r.request().postDataJSON().command);}return json(r,{library});}
  if(path.endsWith('/meeting')){
   if(delayMeeting)await new Promise(resolve=>setTimeout(resolve,delayMeeting));
   if(failMeeting)return json(r,{error:'TEST_FAILURE'},503);
   if(m==='POST'){const b=r.request().postDataJSON();if(b.action==='preview'){const p=library.places.find(p=>p.id===b.sourceId);if(!p)return json(r,{error:'MEETING_OBJECT_UNAVAILABLE'},409);Object.assign(preview,{sourceId:p.id,title:p.title,detail:p.detail,points:[[p.point.lng,p.point.lat]]});return json(r,{preview,fingerprint:'audit-fingerprint'});}if(failSend){failSend=false;return json(r,{error:'TEST_FAILURE'},503);}if(!proposals.some(p=>p.id===b.id))proposals.push({id:b.id,actor:pet.id,status:'sent',preview});return json(r,{proposal:proposals.at(-1)},201);}
   return json(r,{proposals:proposals.map(p=>({...p,mine:p.actor===pet.id}))});
  }
  if(path.startsWith('/api/social/requests')){
   if(m==='POST'){if(failResponse){failResponse=false;return json(r,{error:'TEST_FAILURE'},503);}const b=r.request().postDataJSON();request={id:'audit-request',senderPetId:b.senderPetId,recipientPetId:b.recipientPetId,scenario:b.scenario,source:b.signalId?'signal':'organic',status:'pending'};return json(r,{request},201);}
   if(m==='PATCH'){const b=r.request().postDataJSON();if(failAccept){failAccept=false;return json(r,{error:'TEST_FAILURE'},503);}if(b.action!=='report')request.status=({accept:'accepted',reject:'rejected',cancel:'cancelled',close:'cancelled',block:'blocked'})[b.action];return json(r,{request});}
   return json(r,{requests:request&&(u.searchParams.get('history')==='1'||['pending','accepted'].includes(request.status))?[{...request,telegramContactUrl:request.status==='accepted'&&!s.noContact?'https://t.me/audit_fixture_never_sent':null,otherDog:{name:id==='a'?'Луна':'Мята',avatarUrl:null}}]:[],missingTelegramUsernameAction:s.noContact?'Добавьте username в настройках Telegram, чтобы открыть контакт.':null});
  }
  return json(r,{});
 });
 await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('.app-tabs button[data-route="nearby"]').click();await p.locator('.production-woof-workspace').waitFor();await p.addStyleTag({content:'nextjs-portal{display:none!important}'});
 return {p,s,ctx};
}
async function snap(p,name){await p.waitForTimeout(180);await p.screenshot({path:out+name+'.png'});const text=await p.locator('.gav-dialog[open]').count()?await p.locator('.gav-dialog').innerText():await p.locator('.production-woof-workspace').innerText();shots.push({name,text});await fs.writeFile(out+'states.json',JSON.stringify(shots,null,2));console.log(name);}
async function refresh(p){await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(600);}
async function requests(p){await p.getByRole('button',{name:/^Отклики и связи:/}).click();await p.locator('.woof-overlay').waitFor();}
async function close(p){await p.locator('.gav-dialog').getByRole('button',{name:'Закрыть',exact:true}).first().click();await p.waitForTimeout(200);}
try{
signal={id:'signal-a',petId:'pet-a',name:'Пуня',avatarUrl:null,city:'moscow',district:null,approximateLocation:{lat:55.76,lng:37.62},privacyRadiusMeters:700,startsAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString(),pace:'balanced',note:'',contactVisibility:'hidden_until_mutual_consent'};
const ownedLocation={...signal.approximateLocation};
const a=await user('a');const errors=[];a.p.on('pageerror',e=>errors.push(e.message));a.s.hasArea=true;await refresh(a.p);await a.p.locator('.woof-live-map').waitFor();
const failed=process.env.NO_GPU==='1'||process.env.BLOCK_MAP==='1';
await a.p.locator(`[data-map-state="${failed?'error':'ready'}"]`).waitFor({timeout:30000});
const visibleAction=async()=>{const b=await a.p.getByRole('button',{name:'Изменить Гав',exact:true}).boundingBox(),nav=await a.p.locator('.app-tabs').boundingBox();assert.ok(b&&nav&&b.y>=0&&b.y+b.height<=a.p.viewportSize().height&&!(b.x<nav.x+nav.width&&b.x+b.width>nav.x&&b.y<nav.y+nav.height&&b.y+b.height>nav.y),`active action hidden: ${JSON.stringify({b,nav})}`);};
await visibleAction();await snap(a.p,'01-own-active');
if(!failed){
 assert.equal(await a.p.evaluate(()=>{const canvas=document.querySelector('.woof-live-map .maplibregl-canvas');const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');ext.loseContext();return true;}),true);
 await a.p.locator('[data-map-state="error"]').waitFor();await snap(a.p,'02-context-loss');await visibleAction();
 await a.p.getByRole('button',{name:'Повторить загрузку карты',exact:true}).click();await a.p.locator('[data-map-state="ready"]').waitFor({timeout:30000});await snap(a.p,'03-recovered');
 const viewport=a.p.viewportSize();await a.p.setViewportSize({...viewport,height:viewport.height-60});await a.p.waitForTimeout(300);await a.p.setViewportSize(viewport);await a.p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await a.p.waitForTimeout(300);await visibleAction();
}
if(!failed){
 const before=await a.p.locator('.woof-live-map').boundingBox();await a.p.getByRole('button',{name:'Развернуть карту',exact:true}).click();await a.p.waitForTimeout(500);const expanded=await a.p.locator('.woof-live-map').boundingBox();assert.ok(a.p.viewportSize().width>=800 || expanded.height>before.height+80,`expanded map needs usable additional area: ${JSON.stringify({before,expanded})}`);
 const originalOwn={...signal.approximateLocation};
 await a.p.mouse.move(expanded.x+expanded.width*.75,expanded.y+expanded.height*.6);await a.p.mouse.down();await a.p.mouse.move(expanded.x+expanded.width*.35,expanded.y+expanded.height*.75,{steps:12});await a.p.mouse.up();await a.p.locator('.woof-map-moved').waitFor();
 a.s.peers=true;await a.p.getByRole('button',{name:'Искать здесь · 3 км',exact:true}).click();await a.p.getByRole('button',{name:'Ищем компанию…',exact:true}).waitFor({state:'hidden'});await a.p.locator('.woof-avatar-marker[title^="Луна:"]').waitFor();assert.notDeepEqual(a.s.viewer,originalOwn,'search query must use moved center');assert.deepEqual(signal.approximateLocation,originalOwn,'browsing must not move own signal');
 await a.p.locator('.woof-avatar-marker[title^="Луна:"]').click();await a.p.locator('.woof-signal-card').filter({hasText:'Луна'}).waitFor();await a.p.getByRole('button',{name:'Откликнуться',exact:true}).scrollIntoViewIfNeeded();await snap(a.p,'03b-expanded-search');
 await a.p.getByRole('button',{name:'Район и фильтры',exact:true}).click();await a.p.locator('.woof-live-filters select').first().selectOption('5');await a.p.getByRole('button',{name:'Искать здесь · 5 км',exact:true}).waitFor();await snap(a.p,'03d-expanded-filters');await a.p.getByRole('button',{name:'Район и фильтры',exact:true}).click();await a.p.getByRole('button',{name:/^Список ·/}).click();await a.p.locator('.woof-signal-picker button').filter({hasText:'Луна'}).click();
 await a.p.getByRole('button',{name:'Свернуть карту',exact:true}).click();await a.p.locator('.woof-signal-card').filter({hasText:'Луна'}).waitFor();await a.p.getByRole('button',{name:'Развернуть карту',exact:true}).click();
 failResponse=false;await a.p.getByRole('button',{name:'Откликнуться',exact:true}).click();await a.p.locator('.gav-relationship-heading').getByText('Ждём ответа',{exact:true}).waitFor();await snap(a.p,'03c-map-response');await close(a.p);assert.equal(await a.p.locator('[data-map-expanded="true"]').count(),1);await a.p.getByRole('button',{name:'Свернуть карту',exact:true}).click();request=null;a.s.peers=false;await refresh(a.p);
}
await a.p.getByRole('button',{name:'Изменить Гав',exact:true}).click();await a.p.locator('.woof-composer textarea').fill('Ждём у пруда');await snap(a.p,'04-edit');await a.p.locator('.woof-composer .woof-primary').click();await a.p.locator('.gav-dialog').waitFor({state:'hidden'});assert.equal(signal.note,'Ждём у пруда');assert.deepEqual(signal.approximateLocation,ownedLocation,'editing own note after map exploration must not move own signal');
await a.p.getByRole('button',{name:'Посмотреть анкеты',exact:true}).click();assert.equal(await a.p.locator('.woof-live-map').count(),0);await a.p.getByRole('button',{name:'Сейчас рядом',exact:true}).click();await a.p.locator(`[data-map-state="${failed?'error':'ready'}"]`).waitFor({timeout:30000});await snap(a.p,'05-return');
await a.p.getByRole('button',{name:'Выбрать район вручную',exact:true}).click();await a.p.getByLabel('Город, район или место',{exact:true}).fill('Сокол');a.s.search='error';await a.p.getByRole('button',{name:'Найти район',exact:true}).click();await a.p.getByText('Поиск не ответил. Попробуйте ещё раз — название сохранилось.',{exact:true}).waitFor();await snap(a.p,'06-area-error');await a.p.getByRole('button',{name:'Закрыть выбор района',exact:true}).click();
await a.p.locator('.woof-live-filter-disclosure summary').click();await snap(a.p,'07-filters');await a.p.locator('.woof-live-filter-disclosure summary').click();
a.s.peers=true;await refresh(a.p);await a.p.locator('.woof-signal-picker button').filter({hasText:'Луна'}).click();await a.p.getByRole('button',{name:'Откликнуться',exact:true}).waitFor();await snap(a.p,'08-peer-without-map-dependency');
a.s.signalError=true;await refresh(a.p);await a.p.locator('.woof-error-state').waitFor();await snap(a.p,'09-signal-error');assert.equal(await a.p.locator('.woof-waiting-company').count(),0);a.s.signalError=false;await a.p.locator('.woof-error-state button').click();await a.p.locator('.woof-error-state').waitFor({state:'hidden'});
a.s.peers=false;await refresh(a.p);await a.p.getByRole('button',{name:'Завершить',exact:true}).click();await a.p.getByRole('button',{name:'Дать Гав',exact:true}).waitFor();assert.equal(signal,null);await snap(a.p,'10-ended');
assert.deepEqual(errors,[]);await fs.writeFile(out+'verification.json',JSON.stringify({passed:true,engine:process.env.ENGINE||'chromium',width:process.env.WIDTH||390,height:process.env.HEIGHT||720,failedMap:failed,noGpu:process.env.NO_GPU==='1',errors,fixtures:true},null,2));console.log('LIVE RECOVERY PASS');
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'failure.png'});await fs.writeFile(out+'failure.html',await p.content());await fs.writeFile(out+'geometry.json',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.production-woof-workspace,.woof-map-layer,.woof-work-area,.woof-search-panel,.woof-live-tools,.woof-live-filter-disclosure,.woof-live-filters')].map(e=>({cls:e.className,open:e.open,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollTop}))),null,2));}await fs.writeFile(out+'failure.txt',e.stack);throw e;}finally{await browser.close();}
