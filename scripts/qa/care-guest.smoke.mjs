import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:3111';const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});page.setDefaultTimeout(8000);const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{if(r.request().method()!=='GET')writes.push(new URL(r.request().url()).pathname);return r.fulfill({json:new URL(r.request().url()).pathname==='/api/app/bootstrap'?{empty:true,user:null}:{}});});
 await page.addInitScript(()=>{localStorage.setItem('pso.topapp.onboarding.v1','done');if(!localStorage.getItem('pso.product.profile.v5'))localStorage.setItem('pso.product.profile.v5',JSON.stringify({dogName:'Локи',breedId:'mixed',breedGroupId:'mixed',age:'2 года',lifeStage:'взрослая',sex:'кобель',habits:[],photos:[],selectedStyle:'city',avatarSource:'none'}));});
 const nav=async()=>{await page.locator('.app-tabs button[data-route="all"]').click();await page.locator('[data-tool-destination="calendar"]').click();await page.getByRole('heading',{name:'Забота',exact:true}).waitFor();};
 await page.goto(base);await nav();await page.getByRole('button',{name:'Запланировать',exact:true}).click();await page.getByLabel('Что за дело?').fill('Гостевое дело');await page.getByLabel('Повтор',{exact:true}).selectOption('monthly');await page.getByRole('button',{name:'Сохранить дело',exact:true}).click();await page.getByRole('heading',{name:'Свои дела',exact:true}).waitFor();
 await page.getByRole('button',{name:'Отметить выполненным: Гостевое дело',exact:true}).click();await page.getByRole('button',{name:'Записать выполнение'}).click();await page.locator('.cw-event-open').filter({hasText:'Сделано'}).waitFor();
 await page.reload();await nav();await page.locator('.cw-event-open').filter({hasText:'Сделано'}).click();await page.getByRole('button',{name:'Отменить отметку выполнения'}).click();await page.getByRole('heading',{name:'Забота',exact:true}).waitFor();assert.equal(await page.locator('.cw-event-open').filter({hasText:'Сделано'}).count(),0);
 assert.equal(writes.filter(x=>x.startsWith('/api/reminders')).length,0);assert.deepEqual(errors,[]);console.log('PASS guest create/complete/reload history/undo; no reminder API writes');
}finally{await browser.close();}
