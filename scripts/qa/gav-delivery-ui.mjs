import {readFile} from 'node:fs/promises';
import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:3101';
let activeSignal = null;
let sharedRequest = null;
const requestReads = new Map();
let failSignal=false,failAction=false;
const signalKeys=[];


const appProfile = (pet) => ({ dogName: pet.name, backendPetId: pet.id, breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя', vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить', energyLevel: 'обычный', temperament: 'спокойная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city' });

async function makeUser(browser, { ownerId, pet, location }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: location, permissions: ['geolocation'] });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'Telegram', { configurable: false, value: { WebApp: { initData: 'two-user-fixture', ready() {}, expand() {}, enableClosingConfirmation() {}, openTelegramLink() {} } } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  const page = await context.newPage();
  await page.bringToFront();
  await page.route('**/api/v1/session/telegram', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'telegram', session: { psyoUserId: ownerId, ownerId, firstName: pet.name, username: ownerId } }) }));
  await page.route('**/api/app/bootstrap**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'owner', pet, pets: [pet], profile: appProfile(pet), activePetId: pet.id, reminders: [], wishlist: [], zones: [], routes: [], observations: [], documents: [] }) }));
  await page.route('**/api/social/profile**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: null }) }));
  await page.route('**/api/social/candidates**', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'DISCOVERY_NOT_ENABLED' }) }));
  await page.route('**/api/social/signals**', async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      signalKeys.push(route.request().headers()['idempotency-key']);
      if(failSignal){failSignal=false;return route.fulfill({status:503,json:{error:'TEST_FAILURE'}});}
      activeSignal = { id: 'signal-a', petId: pet.id, name: pet.name, avatarUrl: null, city: 'moscow', district: 'Сокол', approximateLocation: { lat: 55.76, lng: 37.62 }, privacyRadiusMeters: 700, startsAt: body.startsAt, expiresAt: new Date(Date.now() + 7_200_000).toISOString(), pace: body.pace, note: body.note, temperament: 'calm', dogFriendly: 'friendly', isMine: false, contactVisibility: 'hidden_until_mutual_consent' };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ signal: activeSignal }) });
    }
    const visible = activeSignal ? [{ ...activeSignal, isMine: activeSignal.petId === pet.id }] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signals: visible, viewer: { approximateLocation: { lat: location.latitude, lng: location.longitude }, radiusMeters: 3000, city: 'moscow' } }) });
  });
  await page.route('**/api/social/requests**', async (route) => {
    if(route.request().method()==='PATCH'){if(failAction){failAction=false;return route.fulfill({status:503,json:{error:'TEST_FAILURE'}});}sharedRequest={...sharedRequest,status:'accepted'};return route.fulfill({json:{ok:true}});}
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      sharedRequest = { id: 'request-b', senderPetId: body.senderPetId, recipientPetId: body.recipientPetId, scenario: body.scenario, status: 'pending', telegramContactUrl: null, otherDog: { name: pet.name, avatarUrl: null } };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ request: sharedRequest }) });
    }
    requestReads.set(ownerId, (requestReads.get(ownerId) || 0) + 1);
    const requests = sharedRequest && [sharedRequest.senderPetId, sharedRequest.recipientPetId].includes(pet.id) ? [{ ...sharedRequest, otherDog: { name: sharedRequest.senderPetId === pet.id ? 'Мята' : 'Луна', avatarUrl: null } }] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requests, missingTelegramUsernameAction: null }) });
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate((stored) => { localStorage.setItem('pso.topapp.onboarding.v1', 'done'); localStorage.setItem('pso.product.profile.v5', JSON.stringify(stored)); }, appProfile(pet));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-tabs button[data-route="nearby"]').click();
  await page.waitForTimeout(250);
  if (!await page.locator('.production-woof-workspace').count()) {
    await page.getByRole('button', { name: /Гав/ }).last().click();
  }
  await page.locator('.production-woof-workspace').waitFor();
  await page.getByRole('button', { name: 'Сейчас рядом', exact: true }).click();
  await page.waitForTimeout(500);
  return { context, page };
}


for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
const browser = await type.launch({headless:true});
try{
 activeSignal=null;sharedRequest=null;signalKeys.length=0;
 const userA=await makeUser(browser,{ownerId:'owner-a',pet:{id:'pet-a',name:'Мята',owner_id:'owner-a'},location:{latitude:55.76,longitude:37.62}});
 await userA.page.getByRole('button',{name:'Дать Гав',exact:true}).click();
 await userA.page.locator('.woof-composer textarea').fill('Неспешно в парке');
 failSignal=true;
 await userA.page.locator('.woof-composer .woof-primary').click();
 await userA.page.locator('.woof-composer [role="alert"]').waitFor();
 assert.equal(await userA.page.locator('.woof-composer textarea').inputValue(),'Неспешно в парке');
 await userA.page.locator('.woof-composer .woof-primary').click();
 await userA.page.getByText('ваш Гав').waitFor();await userA.page.locator('.woof-composer').waitFor({state:'hidden'});assert.equal(signalKeys.length,2);assert.equal(signalKeys[0],signalKeys[1]);
 await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-active-${engine}-390.png`});
 const alt=await userA.page.addStyleTag({content:await readFile('docs/map-gav-20260907/visual-b.css','utf8')});await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-active-${engine}-390-b.png`});await alt.evaluate(el=>el.remove());
 const userB=await makeUser(browser,{ownerId:'owner-b',pet:{id:'pet-b',name:'Луна',owner_id:'owner-b'},location:{latitude:55.761,longitude:37.621}});
 await userB.page.getByRole('button',{name:'Откликнуться',exact:true}).click().catch(async e=>{console.log('RECEIVER FAILURE',engine,JSON.stringify(activeSignal),await userB.page.locator('.production-woof-workspace').innerText());await userB.page.screenshot({path:`/tmp/gav-receiver-${engine}.png`});throw e;});
 await userA.page.bringToFront();
 await userA.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await userA.page.getByRole('button',{name:'Отклики и связи: 1',exact:true}).click();
 failAction=true;
 await userA.page.getByRole('button',{name:'Принять',exact:true}).click();
 await userA.page.locator('.woof-overlay [role="alert"]').waitFor();
 assert.equal(sharedRequest.status,'pending');
 await userA.page.getByRole('button',{name:'Принять',exact:true}).click();
 await userA.page.getByRole('button',{name:'Место встречи',exact:true}).waitFor();
 await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-connection-${engine}-390.png`});
 await userA.page.keyboard.press('Escape');await userA.page.locator('.woof-overlay').waitFor({state:'hidden'});
 await userA.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Отклики и связи: 1');
 await userA.page.getByRole('button',{name:'Знакомства',exact:true}).click();
 for(const width of [320,390,1280]){
  await userA.page.setViewportSize({width,height:width===1280?720:844});
  await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-empty-${engine}-${width}.png`});
  assert.equal(await userA.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(width===390){const alt=await userA.page.addStyleTag({content:await readFile('docs/map-gav-20260907/visual-b.css','utf8')});await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-empty-${engine}-390-b.png`});await alt.evaluate(el=>el.remove());}
 }

 await userA.context.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(){/* deliberately no GPS callback */},watchPosition(){return 1;},clearWatch(){}}});});
 await userA.page.route('**/api/social/profile**',r=>r.fulfill({json:{profile:{petId:'pet-a',discoverable:true,city:'moscow',district:'Сокол',scenarios:['walk','meet','mating'],coarseLocation:{lat:55.76,lng:37.62}}}}));
 await userA.page.route('**/api/social/candidates**',r=>r.fulfill({json:{nearby:[{petId:'pet-c',name:'Сэр Арчибальд Длинное Имя',avatarUrl:null,lifeStage:'adult',weightKg:15,temperament:'calm',energyLevel:'balanced',dogFriendly:'selective',playStyle:'gentle',district:'Сокол',distance:'до 5 км',sharedScenarios:['walk','meet','mating'],reasons:['Подходит спокойный темп','Оба ищут компанию для прогулки']}],city:[]}}));
 await userA.page.reload({waitUntil:'networkidle'});await userA.page.locator('.app-tabs button[data-route="nearby"]').click();
 await userA.page.getByRole('button',{name:'Знакомства',exact:true}).click();await userA.page.locator('.woof-candidate-card').waitFor().catch(async e=>{await userA.page.screenshot({path:`/tmp/gav-candidates-${engine}-failure.png`});console.log('CANDIDATE FAILURE',engine,await userA.page.locator('.production-woof-workspace').innerText());throw e;});
 await userA.page.setViewportSize({width:390,height:844});
 await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-candidates-${engine}-390.png`});
 const detail=await userA.page.addStyleTag({content:await readFile('docs/map-gav-20260907/visual-b.css','utf8')});await userA.page.screenshot({path:`docs/map-gav-20260907/screens/gav-candidates-${engine}-390-b.png`});await detail.evaluate(el=>el.remove());
 await userA.page.locator('.woof-candidate-card').click();await userA.page.getByRole('heading',{name:'Сэр Арчибальд Длинное Имя'}).waitFor();
 assert.equal(await userA.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await userA.context.close();await userB.context.close();console.log(engine+': Gav failure/retry/idempotency/mutual response/focus/widths PASS');
}finally{await browser.close();}
}
