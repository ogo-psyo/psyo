import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit, type Route } from 'playwright';
import { applyLibraryCommand, emptyMapLibrary } from '../../lib/mapLibrary';

const base=process.env.BASE_URL||'http://127.0.0.1:3238';
const out=process.env.OUT_DIR||'reports/geo-yaroslavl/ui';
await fs.mkdir(out,{recursive:true});

for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]] as const){
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    geolocation:{latitude:57.6184638,longitude:39.8995484},
    permissions:['geolocation'],
    reducedMotion:'reduce',
  });
  const pet={id:'yaroslavl-pet',name:'Мята',owner_id:'yaroslavl-owner'};
  const profile={dogName:pet.name,backendPetId:pet.id,breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',size:'средняя',vaccineStatus:'актуально',parasiteStatus:'актуально',socialMode:'сначала спросить',energyLevel:'обычный',neighborhood:'Ярославль',photos:[],selectedStyle:'city'};
  await context.addInitScript(({profile})=>{
    Object.defineProperty(window,'Telegram',{configurable:false,value:{WebApp:{initData:'yaroslavl-place-fixture',ready(){},expand(){},enableClosingConfirmation(){}}}});
    localStorage.setItem('pso.topapp.onboarding.v1','done');
    localStorage.setItem('pso.product.profile.v5',JSON.stringify(profile));
  },{profile});
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  const errors:string[]=[];
  const catalogResponses:number[]=[];
  let library=emptyMapLibrary();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(new URL(response.url()).pathname==='/api/map/places')catalogResponses.push(response.status());});
  const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  await page.route('https://telegram.org/js/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/api/v1/session/telegram',route=>json(route,{mode:'telegram',session:{psyoUserId:pet.owner_id,ownerId:pet.owner_id,firstName:pet.name}}));
  await page.route('**/api/app/bootstrap**',route=>json(route,{mode:'owner',connected:true,pet,pets:[pet],profile,activePetId:pet.id,reminders:[],wishlist:[],zones:[],routes:[],observations:[],documents:[]}));
  await page.route('**/api/map/features**',route=>json(route,{features:[]}));
  await page.route('**/api/social/**',route=>json(route,{signals:[],requests:[],profile:null,candidates:[]}));
  await page.route('**/api/map/library**',route=>{
    if(route.request().method()==='POST')library=applyLibraryCommand(library,route.request().postDataJSON().command);
    return json(route,{library});
  });

  await page.goto(base,{waitUntil:'commit'});
  await page.locator('.app-tabs button[data-route="map"]').click();
  await page.getByRole('button',{name:'Найти меня',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Вы на карте'}).waitFor();
  await page.getByRole('combobox',{name:'Место или адрес',exact:true}).focus();
  const refresh=page.getByRole('button',{name:'Показать места в этой области',exact:true});
  if(await refresh.isVisible().catch(()=>false))await refresh.click();
  await page.getByRole('status').filter({hasText:'Показано мест:'}).waitFor();
  await page.getByRole('combobox',{name:'Тип места',exact:true}).selectOption('parks');
  const damansky=page.locator('.place-discovery-list').getByRole('button',{name:/о\. Даманский/});
  await damansky.waitFor();
  await damansky.click();
  await page.getByText('условия с собакой неизвестны',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Сохранить место',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Сохранено'}).waitFor();
  assert.equal(library.places.length,1);
  assert.equal(library.places[0]?.source.provider,'osm');
  assert.equal(library.places[0]?.source.id,'osm-way-31106566');
  assert.equal(catalogResponses.includes(200),true);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${engine}-yaroslavl-place.png`,fullPage:true});
  console.log(JSON.stringify({engine,catalogResponses,saved:library.places[0]?.title,unknownDogAccess:true}));
  await context.close();
  await browser.close();
}
