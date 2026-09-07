import fs from 'node:fs/promises';
import {buildWalkingGraph,solveWalkingGraph,walkingBounds} from '../../lib/walkingGraph';
// Public park landmarks, no owner identity or private route fixture.
const points=[[37.6008561,55.7320983],[37.60237,55.73715]];
const b=walkingBounds(points);
const q=`[out:json][timeout:20];way[highway][highway!~"motorway|trunk|proposed|construction"](${b.south},${b.west},${b.north},${b.east});out body;>;out body qt;`;
async function main(){const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:q}),headers:{'User-Agent':'PsoApp/0.2 (https://pso-mvp.vercel.app)'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`provider ${response.status}`);const payload=await response.json();if(payload.remark)throw Error('provider partial response');const g=buildWalkingGraph(payload.elements),route=solveWalkingGraph(g,points);const result={at:new Date().toISOString(),provider:'OpenStreetMap / Overpass',bounds:b,nodes:g.nodes.length,edges:g.edges.length,pathVertices:route.path.length,distanceMeters:route.distanceMeters,minutes:route.estimatedMinutes,stairs:route.stairs,snapDistances:route.snaps.map(s=>s.distanceMeters)};await fs.writeFile('docs/map-route-value-v12/provider-smoke.json',JSON.stringify(result,null,2));console.log(result);}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
