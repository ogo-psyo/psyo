/** Read-only release gate. Check every supported hostname, not just the short alias. */
const expected=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(expected||''))throw Error('Pass the expected full source SHA as the only argument.');
const hosts=['https://pso-mvp.vercel.app','https://pso-mvp-uglanovrms-projects.vercel.app'];
const results=[];
for(const host of hosts){
 const response=await fetch(`${host}/api/internal/health`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
 const health=await response.json();
 const ok=response.ok&&health.ok===true&&health.environment==='production'&&health.release===expected;
 results.push({host,status:response.status,release:health.release,ok});
}
console.log(JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
