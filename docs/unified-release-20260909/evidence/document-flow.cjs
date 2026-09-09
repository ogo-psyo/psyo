const assert=require('node:assert/strict');const {setup,out}=require('./harness.cjs');
(async()=>{for(const engine of ['chromium','webkit'])for(const width of [320,390]){
 const t=await setup(engine,width),{page,nav,state}=t;
 try{
  const keys=[];let fail=true;
  await page.route('**/api/documents',async route=>{
   if(route.request().method()!=='POST')return route.fallback();
   keys.push(route.request().headers()['idempotency-key']);
   if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'DOCUMENT_SAVE_PENDING'})});
   return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({document:{id:'test-document-id',title:'Сохранённый контрольный документ',kind:'analysis',createdAt:new Date().toISOString()}})});
  });
  await nav('profile');await page.getByRole('button',{name:/Здоровье и документы/}).click();
  const add=page.getByRole('button',{name:'Добавить документ',exact:true});await add.click();
  const dialog=page.locator('.profile-document-dialog');
  await dialog.locator('[name=title]').fill('Сохранённый контрольный документ');
  await dialog.locator('[type=file]').setInputFiles({name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF fixture')});
  await page.keyboard.press('Escape');await add.click();
  assert.equal(await dialog.locator('[name=title]').inputValue(),'Сохранённый контрольный документ');
  assert.equal(await dialog.locator('[type=file]').evaluate(e=>e.files[0]?.name),'fixture.pdf');
  await dialog.getByRole('button',{name:/Добавить в историю/}).click();
  await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/Не удалось подтвердить сохранение/);
  await page.screenshot({path:`${out}/document-error-${engine}-${width}.png`});
  await page.keyboard.press('Escape');await nav('nearby');
  assert.equal(await page.getByRole('alert').filter({hasText:'Не удалось подтвердить сохранение'}).count(),0);
  await nav('profile');await add.click();fail=false;
  await dialog.getByRole('button',{name:/Добавить в историю/}).click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('status').filter({hasText:'Документ сохранён'}).waitFor();
  assert.ok(keys[0]);assert.equal(keys[0],keys[1]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(t.errors,[]);
  console.log(`PASS ${engine}/${width}: file+draft after close; scoped 503; same-key retry; correct success; no overflow`);
 }finally{await t.browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
