const {chromium,webkit}=require('playwright');
const fs=require('node:fs/promises');
const out=__dirname;const base='http://127.0.0.1:3285';
async function setup(engine='chromium',width=390){
 const browser=await({chromium,webkit}[engine]).launch();const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
 const pet={id:'11111111-1111-4111-8111-111111111111',owner_id:'qa-owner',name:'Мята',profile_version:0};
 const profile={dogName:pet.name,backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',age:'3 года',lifeStage:'взрослая',sex:'сука',size:'средняя',temperament:'',energyLevel:'',socialMode:'сначала спросить',trainability:'',playStyle:'',aloneTime:'',habits:[],photos:[],selectedStyle:'city',avatarSource:'none'};
 const now=new Date().toISOString();const state={fail:false,requests:[],blocked:[],observations:[{id:'o1',petId:pet.id,note:'Контрольная запись для открытия',mood:'',appetite:'обычный',stool:'',energy:'',createdAt:now,observedAt:now}],documents:[{id:'d1',petId:pet.id,title:'Контрольный документ',kind:'analysis',createdAt:'2026-09-01T09:00:00Z'}],reminders:[{id:'r-done',title:'Завершённое контрольное дело',petId:pet.id,type:'care',dueAt:now,status:'done',done:true,completedAt:now,createdAt:now,recurrence:'none'},{id:'r-active',title:'Текущее контрольное дело',petId:pet.id,type:'care',dueAt:now,status:'active',done:false,createdAt:now,recurrence:'none'}],wishlist:[]};
 await ctx.addInitScript(({profile})=>{Object.defineProperty(window,'Telegram',{value:{WebApp:{initData:'test-fixture-not-valid',ready(){},expand(){},enableClosingConfirmation(){}}}});localStorage.setItem('pso.topapp.onboarding.v1','done');localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));},{profile});
 await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.origin!==base){state.blocked.push(u.hostname);return route.abort();}
  if(!u.pathname.startsWith('/api/'))return route.continue();
  state.requests.push({path:u.pathname,method:req.method(),body:req.postData()});
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname.includes('/session/telegram')||u.pathname==='/api/telegram/session')return json({mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:'QA'}});
  if(u.pathname==='/api/app/bootstrap')return json({mode:'owner',connected:true,activePetId:pet.id,pet,pets:[pet],profile,social:{alone_time_note:state.remoteAlone||'Исходное',...state.social},observations:state.observations,documents:state.documents,reminders:state.reminders,wishlist:state.wishlist,zones:[],routes:[],avatarCapabilities:{identityEnabled:true,uploadsEnabled:true,generationEnabled:false,providerReady:false}});
  if(req.method()!=='GET'&&state.fail)return json({error:'QA_SAVE_FAILURE',message:'Контрольный сбой сохранения'},503);
  if(u.pathname==='/api/observations')return json({observations:state.observations});
  if(u.pathname==='/api/health')return json({entries:state.observations,hasMore:false,nextCursor:null});
  if(u.pathname==='/api/habits')return json({habits:[]});
  if(u.pathname==='/api/documents'){if(req.method()==='POST'){const document={id:'d-created',petId:pet.id,title:'Документ после повтора',kind:'analysis',createdAt:now};state.documents.unshift(document);return json({document},201);}return json({documents:state.documents});}
  if(u.pathname==='/api/pets'||u.pathname==='/api/v1/pets')return json({pet,profile:req.postDataJSON()?.profile||profile});
  if(u.pathname.startsWith('/api/documents/'))return json(req.method()==='DELETE'?{ok:true}:{url:base+'/qa-document'});
  if(u.pathname==='/api/map/library')return json({library:{version:1,collections:[{id:'saved',title:'Все сохранённые',placeIds:[]}],places:[],appliedCommands:[]}});
  if(u.pathname==='/api/map/features')return json({features:[]});
  if(u.pathname==='/api/map/places')return json({error:'AREA_NOT_COVERED'},422);
  if(u.pathname==='/api/map/search')return json({results:[]});
  if(u.pathname.startsWith('/api/social/'))return json({signals:[],requests:[],candidates:[],profile:null,viewer:{approximateLocation:null}});
  return json({});
 });
 const page=await ctx.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('.app-tabs').waitFor({timeout:60000});await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
 async function nav(tab){if(['things','diary'].includes(tab)){await page.locator('.app-tabs button[data-route="all"]').click();await page.locator(`[data-tool-destination="${tab}"]`).click();await page.waitForTimeout(150);return;}await page.locator(`.app-tabs button[data-route="${tab}"]`).click();await page.waitForTimeout(150);}
 async function snapshot(name){await page.screenshot({path:`${out}/${engine}-${width}-${name}.png`,fullPage:false});return page.locator('body').innerText();}
 return {browser,ctx,page,nav,snapshot,state,errors,profile,pet};
}
module.exports={setup,out,fs};
if(require.main===module)(async()=>{const t=await setup();try{for(const tab of ['profile','things','today','nearby','map']){await t.nav(tab);console.log(tab, (await t.snapshot(tab)).slice(-7500));}}finally{await fs.writeFile(out+'/explore-requests.json',JSON.stringify(t.state,null,2));await t.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
