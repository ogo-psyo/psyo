const assert=require('node:assert/strict');
const {setup,out,fs}=require('./harness.cjs');
(async()=>{
 const results=[];
 for(const engine of ['chromium','webkit'])for(const width of [320,390]){
  const t=await setup(engine,width),{page,nav,state}=t;
  try{
   let attempts=0;
   await page.route('**/api/agent/runs?*',r=>r.fulfill({json:{enabled:true,latest:null}}));
   await page.route('**/api/assistant',r=>{attempts++;return r.fulfill({status:attempts===1?503:200,json:attempts===1?{error:'fixture_failure'}:{answer:'Демонстрационный длинный ответ.\n\n'+('Текст для проверки чтения и доступности ввода. '.repeat(18)+'\n\n').repeat(8),provider:'groq',mode:'groq_contextual',suggestedQuestions:['Что ещё уточнить?']}});});
   await nav('things');await page.getByRole('button',{name:'Добавить вещь',exact:true}).click();
   const capture=page.locator('.thing-capture');await capture.getByLabel('Название',{exact:true}).fill('Сохранившийся ввод');
   state.fail=true;await capture.getByRole('button',{name:'Добавить в вещи',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Покупка не сохранилась'}).waitFor();
   const trigger=page.getByRole('button',{name:'Спросить Псё',exact:true}).first();await trigger.click();
   const dialog=page.getByRole('dialog',{name:'Спросить Псё',exact:true});
   assert.equal(await dialog.getByRole('alert').count(),0,'other domain error leaked into assistant');
   const group=await dialog.evaluate(el=>{const h=el.querySelector('h3'),i=el.querySelector('[data-assistant-composer]');return {font:parseFloat(getComputedStyle(h).fontSize),gap:i.getBoundingClientRect().top-h.getBoundingClientRect().bottom};});
   assert.ok(group.font>=40&&group.gap>=0&&group.gap<65,'question and composer grouping regressed');
   await page.screenshot({path:`${out}/assistant-entry-${engine}-${width}.png`});
   await dialog.getByText('С чего начать',{exact:true}).click();
   const idea=dialog.locator('details').filter({has:page.getByText('С чего начать',{exact:true})}).getByRole('button').first();
   const question=await idea.innerText();await idea.click();await dialog.getByRole('alert').waitFor();
   assert.equal(await dialog.getByLabel('Вопрос ассистенту').inputValue(),question,'failed preset lost request');
   await dialog.getByRole('button',{name:'Отправить',exact:true}).click();
   await dialog.getByText('Демонстрационный длинный ответ.',{exact:false}).waitFor();
   await page.setViewportSize({width,height:480});
   const metrics=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),c=el.querySelector('[data-assistant-composer]').getBoundingClientRect(),sc=el.querySelector('[data-assistant-scroll]');return {top:r.top,bottom:r.bottom,composer:c.bottom,overflow:el.scrollWidth>el.clientWidth+1,canScroll:sc.scrollHeight>sc.clientHeight};});
   assert.ok(metrics.top>=0&&metrics.bottom<=481&&metrics.composer<=481);assert.equal(metrics.overflow,false);assert.equal(metrics.canScroll,true);
   await dialog.locator('[data-assistant-scroll]').evaluate(el=>el.scrollTop=300);
   await page.screenshot({path:`${out}/assistant-short-viewport-${engine}-${width}.png`});
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   assert.equal(await capture.getByLabel('Название',{exact:true}).inputValue(),'Сохранившийся ввод');
   await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Спросить Псё');
   assert.deepEqual(t.errors,[]);results.push({engine,width,pass:true,scope:'synthetic API; viewport shrink is not physical keyboard acceptance'});
   console.log(`PASS ${engine}/${width}: entry, scoped error, preset retry, long reply, 480px viewport, original form and focus`);
  }finally{await t.browser.close();}
 }
 await fs.writeFile(out+'/assistant-surface-ui.json',JSON.stringify(results,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
