const assert=require('node:assert/strict');const {setup}=require('./harness.cjs');
(async()=>{const t=await setup('chromium',390),{ctx,page,pet,profile}=t;
try{
 const time='2026-09-09T09:00:00.123Z';let rows=Array.from({length:27},(_,i)=>({id:`44444444-4444-4444-8444-${String(100-i).padStart(12,'0')}`,petId:pet.id,note:`Одновременная запись ${i+1}`,observedAt:time,createdAt:time}));
 const json=(r,v,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(v)});
 await ctx.route('**/api/app/bootstrap*',r=>json(r,{mode:'owner',connected:true,activePetId:pet.id,pet,pets:[pet],profile,observations:rows.slice(0,20),documents:[],reminders:[],wishlist:[],zones:[],routes:[],avatarCapabilities:{generationEnabled:false}}));
 await ctx.route('**/api/health?*',r=>{const before=new URL(r.request().url()).searchParams.get('before');return json(r,{entries:before?rows.slice(20):rows.slice(0,20),hasMore:!before,nextCursor:before?null:JSON.stringify({at:time,id:rows[19].id})});});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await t.nav('all');await page.locator('[data-tool-destination="health"]').click();
 const records=page.locator('[data-observation-id]');await page.getByRole('button',{name:'Загрузить более ранние'}).waitFor();assert.equal(await records.count(),20);
 await page.getByRole('button',{name:'Загрузить более ранние'}).click();await records.nth(26).waitFor();assert.equal(await records.count(),27);
 // Profile save triggers bootstrap's limited20 snapshot. It must not discard loaded pages.
 await ctx.route('**/api/v1/pets',r=>{pet.profile_version=1;return json(r,{pet:{id:pet.id,profileVersion:1}});});
 await page.locator('.health-facts summary').click();await page.getByLabel('Аллергии',{exact:true}).fill('Тест');
 await Promise.all([page.waitForResponse(r=>r.url().includes('/api/app/bootstrap')),page.getByRole('button',{name:'Сохранить постоянные данные'}).click()]);
 await page.waitForTimeout(150);assert.equal(await records.count(),27);
 // New document/session reload must start a new chain, never resurrect deleted local cache.
 rows=rows.slice(1);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-tabs').waitFor();await t.nav('all');await page.locator('[data-tool-destination="health"]').click();await page.getByRole('button',{name:'Загрузить более ранние'}).waitFor();
 assert.equal(await records.count(),20);assert.equal(await page.getByText('Одновременная запись 1',{exact:true}).count(),0);
 console.log('PASS equal-time27 records survive profile bootstrap; cold reload resets cursor and removes deleted cached record');
}finally{await t.browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
