import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { applyLibraryCommand, emptyMapLibrary } from '../../lib/mapLibrary.ts';
import fs from 'node:fs/promises';
const out=process.env.OUT_DIR||'docs/gav-complete-journey/edges/';await fs.mkdir(out,{recursive:true});
const base=process.env.BASE_URL||'http://localhost:3258';
const browser=await (process.env.ENGINE==='webkit'?webkit:chromium).launch();
let failSignal=true, failProfile=true, failResponse=true, failLibrary=true;
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
 const s={library:false,hasProfile:false,hasArea:false,search:'ready',noContact:false};
 const ctx=await browser.newContext({viewport:{width:Number(process.env.WIDTH)||390,height:844},geolocation:{latitude:55.76,longitude:37.62},permissions:['geolocation'],reducedMotion:'reduce'});
 await ctx.addInitScript(({profile})=>{
 window.__chatAttempts=[];
 Object.defineProperty(window,'Telegram',{configurable:false,value:{WebApp:{initData:'audit-fixture-only',ready(){},expand(){},enableClosingConfirmation(){},openTelegramLink(url){window.__chatAttempts.push(url)}}}});
 localStorage.setItem('pso.topapp.onboarding.v1','done');localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));
 },{profile});
 const p=await ctx.newPage();p.setDefaultTimeout(15000);
 await p.route('https://telegram.org/js/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.route('**/api/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname,m=r.request().method();
  if(path==='/api/v1/session/telegram')return json(r,{mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:pet.name}});
  if(path==='/api/app/bootstrap')return json(r,{mode:'owner',connected:true,pet,pets:[pet],profile,activePetId:pet.id,reminders:[],wishlist:[],zones:[],routes:[],observations:[],documents:[]});
  if(path.startsWith('/api/social/invites/')){if(m==='POST'){request={id:'invite-request',senderPetId:'pet-a',recipientPetId:pet.id,scenario:'walk',source:'invite',status:'pending'};return json(r,{request});}if(u.pathname.endsWith('gone'))return json(r,{error:'INVITE_GONE'},410);return json(r,{invite:{scenario:'walk',pet:{name:'Мята'},expiresAt:new Date(Date.now()+7200000).toISOString()}});}
  if(path==='/api/social/profile'){
   if(m==='PUT'){if(failProfile){failProfile=false;return json(r,{error:'TEST_FAILURE'},503);}s.hasProfile=true;}
   return json(r,{profile:s.hasProfile?{petId:pet.id,discoverable:true,city:'moscow',district:'Сокол',coarseLocation:{lat:55.76,lng:37.62},scenarios:['walk','meet']}:null});
  }
  if(path==='/api/social/candidates')return s.hasProfile?json(r,{nearby:request&&['pending','accepted'].includes(request.status)?[]:[{petId:id==='a'?'pet-b':'pet-a',name:id==='a'?'Луна':'Мята',avatarUrl:null,lifeStage:'adult',weightKg:15,temperament:'calm',energyLevel:'balanced',dogFriendly:'friendly',playStyle:'мягко',city:'moscow',district:'Сокол',scenarios:['walk','meet'],sharedScenarios:['walk','meet'],distance:'до 5 км',reasons:['Спокойный ритм','Любит прогулки'],contactVisibility:'hidden_until_mutual_consent'}],city:[]}):json(r,{error:'DISCOVERY_NOT_ENABLED'},409);
  if(path==='/api/social/signals'){
   if(m==='PUT'){if(failSignal){failSignal=false;return json(r,{error:'TEST_FAILURE'},503);}const b=r.request().postDataJSON();signal={id:'signal-a',petId:pet.id,name:pet.name,avatarUrl:null,city:'moscow',district:'Сокол',approximateLocation:{lat:55.76,lng:37.62},privacyRadiusMeters:700,startsAt:b.startsAt,expiresAt:new Date(Date.now()+7200000).toISOString(),pace:b.pace,note:b.note,temperament:'calm',dogFriendly:'friendly',contactVisibility:'hidden_until_mutual_consent'};return json(r,{signal},201);}
   if(!s.hasArea&&!u.searchParams.has('lat'))return json(r,{error:'VIEWER_LOCATION_REQUIRED'},409);
   s.hasArea=true;return json(r,{signals:signal?[{...signal,isMine:signal.petId===pet.id}]:[],viewer:{approximateLocation:{lat:55.76,lng:37.62},radiusMeters:3000,city:'moscow'}});
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
failProfile=false;failLibrary=false;failResponse=false;failSignal=false;
const b=await user('b');b.s.hasArea=true;
request={id:'audit-request',senderPetId:'pet-a',recipientPetId:'pet-b',scenario:'walk',source:'signal',status:'accepted'};await refresh(b.p);await b.p.locator('.gav-resume-connection button').click();await b.p.getByRole('button',{name:/^(Предложить место|Продолжить выбор места)$/}).waitFor();
failMeeting=true;await b.p.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.p.getByRole('button',{name:'Повторить загрузку',exact:true}).waitFor();await snap(b.p,'01-load-error');failMeeting=false;await b.p.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await b.p.getByRole('button',{name:/^(Предложить место|Продолжить выбор места)$/}).click();await b.p.getByRole('button',{name:'На карте',exact:true}).click();await b.p.locator('.meeting-preview-map .leaflet-container').waitFor();
await b.p.locator('.meeting-preview-map .leaflet-container').click({position:{x:140,y:100}});await b.p.getByRole('button',{name:'Сохранить и проверить',exact:true}).waitFor();await b.p.getByLabel('Название места',{exact:true}).fill('У входа');await snap(b.p,'02-map-pick');await close(b.p);await requests(b.p);await b.p.locator('.gav-connection-row').first().click();await b.p.getByRole('button',{name:'Продолжить выбор места',exact:true}).click();assert.equal(await b.p.getByLabel('Название места',{exact:true}).inputValue(),'У входа');await b.p.getByRole('button',{name:'Сохранить и проверить',exact:true}).click();await b.p.getByRole('button',{name:'Предложить это место',exact:true}).waitFor();await b.p.getByRole('button',{name:'Изменить место',exact:true}).click();assert.equal(await b.p.getByRole('button',{name:'Предложить это место',exact:true}).count(),0);await b.p.getByRole('button',{name:'Сохранённое',exact:true}).click();await b.p.locator('.gav-meeting-editor select').selectOption({label:'У входа'});await b.p.getByRole('button',{name:'Проверить место',exact:true}).click();await b.p.getByRole('button',{name:'Предложить это место',exact:true}).waitFor();await snap(b.p,'03-saved-preview');await b.p.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(proposals.length,0);
// Reload/keyboard close must return to the same source, not leave background controls active.
await b.p.keyboard.press('Escape');await b.p.locator('.gav-dialog').waitFor({state:'detached'});await requests(b.p);await b.p.locator('.gav-connection-row').first().focus();await b.p.keyboard.press('Enter');await b.p.getByRole('button',{name:/^(Предложить место|Продолжить выбор места)$/}).waitFor();await b.p.getByRole('button',{name:'Закрыть',exact:true}).focus();await b.p.keyboard.press('Shift+Tab');assert(await b.p.evaluate(()=>!!document.activeElement.closest('dialog')));await close(b.p);
request=null;await b.p.goto(base+'/?socialInvite=fixture-invite',{waitUntil:'domcontentloaded'});await b.p.locator('.woof-incoming-invite').getByRole('button',{name:'Принять',exact:true}).waitFor();await snap(b.p,'04-invite');await b.p.locator('.woof-incoming-invite').getByRole('button',{name:'Принять',exact:true}).click();await b.p.locator('.gav-resume-connection button').waitFor();await b.p.locator('.gav-resume-connection button').click();assert.equal(request.source,'invite');await snap(b.p,'05-invite-continuation');await close(b.p);
await b.p.goto(base+'/?socialInvite=gone',{waitUntil:'domcontentloaded'});await b.p.locator('.app-tabs button[data-route="nearby"]').click();await b.p.getByText('Приглашение уже закрыто',{exact:true}).waitFor();await snap(b.p,'06-invite-expired');
await fs.writeFile(out+'verification.json',JSON.stringify({fixture:true,passed:true,states:shots.length,engine:process.env.ENGINE||'chromium'},null,2));console.log('EDGES PASS');
}catch(e){await fs.writeFile(out+'failure.txt',e.stack);throw e;}finally{await browser.close();}
