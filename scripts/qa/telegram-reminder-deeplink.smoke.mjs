import { chromium } from 'playwright';

const base=process.env.BASE_URL||'http://localhost:4323';
const reminderId='123e4567-e89b-42d3-a456-426614174000';
const profile={dogName:'Плутон',breedId:'mixed',breedGroupId:'mixed',lifeStage:'взрослая',photos:[],selectedStyle:'city',backendPetId:'guest-reminder-link'};
const reminder={id:reminderId,petId:profile.backendPetId,type:'grooming',title:'Груминг',dueAt:'2026-09-29T18:00:00+03:00',recurrence:'none',status:'active',timeMode:'exact',reminderPreference:'day'};

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/api/app/bootstrap*',route=>route.fulfill({json:{mode:'demo',connected:false,empty:true,pets:[],notificationCapabilities:{telegramEnabled:true}}}));
  await page.addInitScript(({storedProfile,storedReminder})=>{
    localStorage.setItem('pso.topapp.onboarding.v1','done');
    localStorage.setItem('pso.product.profile.v5',JSON.stringify(storedProfile));
    localStorage.setItem(`pso.product.entities.v1:${storedProfile.backendPetId}`,JSON.stringify({reminders:[storedReminder],wishlist:[],zones:[],routes:[]}));
  },{storedProfile:profile,storedReminder:reminder});
  await page.goto(`${base}/?careReminder=${reminderId}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Груминг',exact:true}).waitFor({timeout:10_000}).catch(async error=>{
    const headings=await page.getByRole('heading').allTextContents();
    throw new Error(`deep link did not open reminder; headings=${JSON.stringify(headings)} url=${page.url()}`,{cause:error});
  });
  await page.getByText('Бот напомнит в Telegram.',{exact:true}).waitFor({timeout:10_000}).catch(async error=>{
    throw new Error(`notification state missing; body=${JSON.stringify((await page.locator('body').innerText()).slice(0,600))}`,{cause:error});
  });
  if(new URL(page.url()).searchParams.has('careReminder'))throw new Error('deep-link query was not consumed');
  console.log(JSON.stringify({ok:true,scenario:'Telegram Open → exact care reminder'}));
}finally{await browser.close();}
