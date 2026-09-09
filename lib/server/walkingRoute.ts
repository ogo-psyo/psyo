import { buildWalkingGraph, solveWalkingGraph, walkingBounds, type OsmElement, type WalkingGraph } from '@/lib/walkingGraph';
import { parseRoutePlanning } from '@/lib/routePlanning';
import { getSupabaseAdmin } from '@/lib/server/supabase';
const cache = new Map<string, {
    time: number;
    graph: WalkingGraph;
}>();
async function readLimited(response: Response) { const reader = response.body?.getReader(); if (!reader)
    throw Error('UPSTREAM_UNAVAILABLE'); const chunks: Uint8Array[] = []; let size = 0; for (;;) {
    const { done, value } = await reader.read();
    if (done)
        break;
    size += value.length;
    if (size > 16000000) {
        await reader.cancel();
        throw Error('GRAPH_LIMIT');
    }
    chunks.push(value);
} const bytes = new Uint8Array(size); let at = 0; for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
} return JSON.parse(new TextDecoder().decode(bytes)) as {
    elements?: OsmElement[];
    remark?: string;
}; }

export type WalkingPath = ReturnType<typeof solveWalkingGraph> & {source:'OpenStreetMap';calculatedAt:string};
export type WalkingOutcome = {status:200;result:WalkingPath}|{status:400|422|429|503;error:string;retryAfter?:string};
export async function calculateWalkingPath(inputPoints:unknown,signal?:AbortSignal):Promise<WalkingOutcome>{
    signal?.throwIfAborted();
        const plan = parseRoutePlanning({ version: 1, mode: 'walking', stops: (Array.isArray(inputPoints) ? inputPoints : []).map((point: unknown) => ({ point })) });
        if (!plan || plan.stops.length < 2 || plan.stops.length > 100)
            return {error:'POINT_LIMIT',status:400};
        try {
            const points = plan.stops.map(s => s.point), bounds = walkingBounds(points), key = JSON.stringify(bounds);
            let graph = cache.get(key)?.graph;
            if (Date.now() - (cache.get(key)?.time || 0) > 86400000)
                graph = undefined;
            if (!graph) {
                const db = getSupabaseAdmin();
                if (!db)
                    return {error:'ROUTING_UNAVAILABLE',status:503};
                const slot = await db.rpc('take_map_walk_slot');
                if (slot.error || slot.data !== true)
                    return {error:'ROUTING_QUOTA',status:429,retryAfter:'5'};
                const q = `[out:json][timeout:20];way[highway][highway!~"motorway|trunk|proposed|construction"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});out body;>;out body qt;`;
                const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PsoApp/0.2 (https://pso-mvp.vercel.app)' }, signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) });
                if (!response.ok)
                    throw Error('UPSTREAM_UNAVAILABLE');
                const payload = await readLimited(response);
                if (payload.remark || !Array.isArray(payload.elements) || payload.elements.length > 200000)
                    throw Error('GRAPH_LIMIT');
                graph = buildWalkingGraph(payload.elements);
                if (graph.nodes.length > 100000 || graph.edges.length > 160000)
                    throw Error('GRAPH_LIMIT');
                if (cache.size >= 8)
                    cache.delete(cache.keys().next().value!);
                cache.set(key, { time: Date.now(), graph });
            }
            signal?.throwIfAborted();
            return {status:200,result:{...solveWalkingGraph(graph, points),source:'OpenStreetMap',calculatedAt:new Date().toISOString()}};
        }
        catch (error) {
            const code = error instanceof Error ? error.message : '';
            const allowed = ['AREA_LIMIT', 'POINT_LIMIT', 'GRAPH_LIMIT', 'NO_NEARBY_PATH', 'NO_PATH', 'POINTS_TOO_CLOSE', 'CALCULATION_LIMIT', 'GEOMETRY_LIMIT'];
            return {error:allowed.includes(code)?code:'ROUTING_UNAVAILABLE',status:allowed.includes(code)?422:503};
        }
}
