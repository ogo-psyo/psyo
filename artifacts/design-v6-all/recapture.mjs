import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const b=await chromium.launch();const checks=[];
try {for(const width of [320,390,1280])for(const name of ['card','capture','gav_requests','public']) {
 const p=await b.newPage({viewport:{width,height:width===1280?900:844}});await p.route('https://telegram.org/**',r=>r.abort());await p.goto('http://localhost:3214/?demo=1',{waitUntil:'networkidle'});
 if(name==='public')await p.goto('http://localhost:3214/dog/card?demo=1&name=Плутон');else if(name==='gav_requests'){await p.locator('.app-tabs [data-route="nearby"]').click();await p.getByRole('button',{name:/Отклики и связи/}).click();await p.locator('.woof-overlay-x').waitFor();}else{await p.locator('.app-tabs [data-route="profile"]').click();await p.getByRole('button',{name:name==='card'?/Памятка для близких/:'Добавить запись',exact:name==='capture'}).click();}
 await p.waitForTimeout(400);await p.screenshot({path:`artifacts/design-v6-all/${name}-${width}.png`,animations:'disabled'});
 if(name==='gav_requests'){let hit=await p.locator('.woof-overlay-x').evaluate(e=>{let r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});if(!hit)throw Error(`Close button occluded at ${width}`);await p.locator('.woof-overlay-x').click();await p.locator('.woof-overlay').waitFor({state:'detached'});checks.push({width,name,visibleExit:true,clickCloses:true});}
 else checks.push({width,name,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 await p.close();
}}finally{await b.close()}
await fs.writeFile('artifacts/design-v6-all/review-fix-metrics.json',JSON.stringify(checks,null,2));console.log(checks);
