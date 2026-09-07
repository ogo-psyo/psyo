import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { applyLibraryCommand, emptyMapLibrary } from '../../lib/mapLibrary.ts';
import fs from 'node:fs/promises';
const out=process.env.OUT_DIR||'docs/gav-complete-journey/evidence/';await fs.mkdir(out,{recursive:true});
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
const a=await user('a'),b=await user('b');
await a.p.getByRole('button',{name:'Найти рядом со мной',exact:true}).click();await a.p.getByRole('button',{name:'Дать Гав',exact:true}).waitFor();await a.p.getByRole('button',{name:'Дать Гав',exact:true}).click();await a.p.locator('.gav-dialog[open]').waitFor();await a.p.getByRole('button',{name:'Позже',exact:true}).click();await a.p.locator('.woof-composer textarea').fill('У пруда, без спешки');await snap(a.p,'01-composer');await a.p.getByRole('button',{name:'Сейчас',exact:true}).click();await a.p.locator('.woof-composer .woof-primary').click();await a.p.locator('.woof-composer [role=alert]').waitFor();assert.equal(await a.p.locator('.woof-composer textarea').inputValue(),'У пруда, без спешки');await snap(a.p,'01b-signal-error');await a.p.locator('.woof-composer .woof-primary').click();await a.p.getByText('ваш Гав').waitFor();
b.s.hasArea=true;await refresh(b.p);await b.p.getByRole('button',{name:'Откликнуться',exact:true}).click();await b.p.locator('.woof-action-error').waitFor();assert.equal(request,null);await snap(b.p,'01c-response-error');await b.p.getByRole('button',{name:'Откликнуться',exact:true}).click();await b.p.locator('.gav-connection-identity').filter({hasText:'Мята'}).waitFor();await snap(b.p,'02-pending');assert(await b.p.getByText('Ждём ответа',{exact:true}).isVisible());
await refresh(a.p);await a.p.locator('.gav-resume-connection button').click();await a.p.getByRole('button',{name:'Принять',exact:true}).waitFor();await snap(a.p,'03-incoming');failAccept=true;await a.p.getByRole('button',{name:'Принять',exact:true}).click();await a.p.locator('.gav-dialog [role=alert]').waitFor();await snap(a.p,'04-accept-error');await a.p.getByRole('button',{name:'Принять',exact:true}).click();await a.p.getByRole('button',{name:'Предложить место',exact:true}).waitFor();await snap(a.p,'05-accepted');
await a.p.getByRole('button',{name:'Предложить место',exact:true}).click();await a.p.getByRole('button',{name:'Сохранённое',exact:true}).click();await snap(a.p,'06-empty-saved');await a.p.getByRole('button',{name:'Найти',exact:true}).click();await a.p.getByLabel('Место или адрес',{exact:true}).fill('Парк');a.s.search='error';await a.p.getByRole('button',{name:'Найти место',exact:true}).click();await a.p.getByText('Поиск не ответил. Название сохранилось — попробуйте ещё раз.',{exact:true}).waitFor();await snap(a.p,'07-search-error');a.s.search='ready';await a.p.getByRole('button',{name:'Найти место',exact:true}).click();await a.p.locator('.gav-place-choice').first().click();await a.p.getByRole('button',{name:'Сохранить и проверить',exact:true}).click();await a.p.getByText('Место не сохранилось. Попробуйте ещё раз — ваш выбор остался.',{exact:true}).waitFor();await snap(a.p,'07b-place-save-error');await a.p.getByRole('button',{name:'Сохранить и проверить',exact:true}).click();await a.p.getByRole('button',{name:'Предложить это место',exact:true}).waitFor();await snap(a.p,'08-preview');
failSend=true;await a.p.getByRole('button',{name:'Предложить это место',exact:true}).click();await a.p.getByText('Отправка не подтверждена. Повторите — второе предложение не появится.',{exact:true}).waitFor();await snap(a.p,'09-send-error');await a.p.getByRole('button',{name:'Предложить это место',exact:true}).click();await a.p.locator('.gav-meeting-proposal').waitFor();assert.equal(proposals.length,1);await snap(a.p,'10-sent');
await refresh(b.p);await b.p.locator('.gav-meeting-proposal').waitFor();await snap(b.p,'11-received');assert.equal(await b.p.locator('.gav-meeting-editor').count(),0);assert(await b.p.locator('.gav-connection-identity').filter({hasText:'Мята'}).isVisible());
await b.p.goBack();await b.p.getByRole('heading',{name:'Ваша компания',exact:true}).waitFor();await snap(b.p,'12-back-list');await close(b.p);await requests(b.p);await b.p.getByRole('heading',{name:'Ваша компания',exact:true}).waitFor();await b.p.locator('.gav-connection-row').first().click();await b.p.locator('.gav-meeting-proposal').waitFor();
await b.p.getByRole('button',{name:'Открыть чат',exact:true}).click();assert.equal((await b.p.evaluate(()=>window.__chatAttempts)).length,1);
b.s.noContact=true;await refresh(b.p);await b.p.getByRole('button',{name:'Проверить контакт',exact:true}).waitFor();await snap(b.p,'13-no-contact');
await b.p.reload({waitUntil:'domcontentloaded'});await b.p.locator('.app-tabs button[data-route="nearby"]').click();await b.p.locator('.gav-resume-connection button').click();await b.p.locator('.gav-meeting-proposal').waitFor();await snap(b.p,'14-reopened');
await b.p.getByText('Другие действия',{exact:true}).click();await b.p.getByRole('button',{name:'Пожаловаться',exact:true}).click();await b.p.getByLabel('Что произошло').fill('Проверка возврата');await snap(b.p,'15-report');await b.p.getByRole('button',{name:'Отмена',exact:true}).click();await b.p.getByRole('button',{name:'Заблокировать',exact:true}).click();await snap(b.p,'16-block-confirm');await b.p.getByRole('button',{name:'Отмена',exact:true}).click();await b.p.getByRole('button',{name:'Завершить знакомство',exact:true}).click();await b.p.getByRole('button',{name:'Да, завершить',exact:true}).click();await b.p.getByText('Знакомство закрыто',{exact:true}).waitFor();assert.equal(await b.p.locator('.meeting-place-panel').count(),0);assert.equal(await b.p.getByRole('button',{name:'Открыть чат',exact:true}).count(),0);await snap(b.p,'17-closed');await b.p.getByRole('button',{name:'← К откликам',exact:true}).click();await b.p.getByText(/Завершённые знакомства ·/).click();await snap(b.p,'18-history');await close(b.p);
request=null;await b.p.getByRole('button',{name:'Знакомства',exact:true}).click();await b.p.getByRole('button',{name:'Создать анкету',exact:true}).first().click();await b.p.locator('.social-scenarios label').filter({hasText:'Прогулка'}).click();await snap(b.p,'19-profile');await b.p.getByRole('button',{name:'Опубликовать анкету',exact:true}).click();await b.p.locator('.gav-dialog [role=alert]').waitFor();assert(await b.p.getByRole('checkbox',{name:'Прогулка',exact:true}).isChecked());await snap(b.p,'19b-profile-error');await b.p.getByRole('button',{name:'Опубликовать анкету',exact:true}).click();await b.p.locator('.gav-deck-card').waitFor();await snap(b.p,'20-profile-return');await b.p.getByText('О собаке подробнее',{exact:true}).click();await snap(b.p,'21-details');await b.p.getByRole('button',{name:'Откликнуться',exact:true}).click();await b.p.locator('.gav-relationship-heading').getByText('Ждём ответа',{exact:true}).waitFor();assert.equal(request.source,'organic');await snap(b.p,'22-profile-pending');
await fs.writeFile(out+'verification.json',JSON.stringify({fixture:true,source:'working-tree',width:process.env.WIDTH||390,engine:process.env.ENGINE||'chromium',proposals:proposals.length,states:shots.length,passed:true},null,2));console.log('COMPLETE JOURNEY PASS');
}catch(e){await fs.writeFile(out+'failure.txt',e.stack);throw e;}finally{await browser.close();}
