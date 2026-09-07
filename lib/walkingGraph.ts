import { distanceMeters } from './geo';
export type OsmElement = {
    type: string;
    id: number;
    lon?: number;
    lat?: number;
    nodes?: number[];
    tags?: Record<string, string>;
};
export type WalkingGraph = {
    nodes: number[][];
    edges: number[][];
};
const meters = (a: number[], b: number[]) => distanceMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
const walkable = new Set(['footway', 'pedestrian', 'path', 'steps', 'residential', 'living_street', 'service', 'unclassified']);
export function buildWalkingGraph(elements: OsmElement[]): WalkingGraph {
    const ns = new Map(elements.filter(n => n.type === 'node' && Number.isFinite(n.lat) && Number.isFinite(n.lon)).map(n => [n.id, n]));
    const ids = new Map<number, number>(), nodes: number[][] = [], edges: number[][] = [];
    for (const w of elements) {
        const t = w.tags || {}, explicit = ['yes', 'designated', 'permissive'].includes(t.foot);
        if (w.type !== 'way' || !w.nodes || (!walkable.has(t.highway) && !(t.highway === 'cycleway' && explicit)) || ['no', 'private', 'use_sidepath'].includes(t.foot) || (['no', 'private', 'customers', 'delivery'].includes(t.access) && !explicit) || t.area === 'yes' || t.indoor === 'yes')
            continue;
        for (let i = 1; i < w.nodes.length; i++) {
            const pair = [ns.get(w.nodes[i - 1]), ns.get(w.nodes[i])];
            if (pair.some(n => !n || (['no', 'private'].includes(n.tags?.access || '') && !['yes', 'designated'].includes(n.tags?.foot || ''))))
                continue;
            for (const n of pair) {
                if (n && !ids.has(n.id)) {
                    ids.set(n.id, nodes.length);
                    nodes.push([n.lon!, n.lat!]);
                }
            }
            edges.push([ids.get(w.nodes[i - 1])!, ids.get(w.nodes[i])!, t.highway === 'steps' ? 1 : 0, t['oneway:foot'] === 'yes' ? 1 : t['oneway:foot'] === '-1' ? -1 : 0]);
        }
    }
    return { nodes, edges };
}
class Heap {
    a: number[][] = [];
    push(x: number[]) { let i = this.a.length; this.a.push(x); while (i) {
        const p = (i - 1) >> 1;
        if (this.a[p][0] <= x[0])
            break;
        this.a[i] = this.a[p];
        i = p;
    } this.a[i] = x; }
    pop() { const root = this.a[0], x = this.a.pop()!; if (this.a.length) {
        let i = 0;
        while (2 * i + 1 < this.a.length) {
            let j = 2 * i + 1;
            if (j + 1 < this.a.length && this.a[j + 1][0] < this.a[j][0])
                j++;
            if (this.a[j][0] >= x[0])
                break;
            this.a[i] = this.a[j];
            i = j;
        }
        this.a[i] = x;
    } return root; }
}
export function solveWalkingGraph(g: WalkingGraph, points: number[][]) {
    if (points.length < 2 || points.length > 100)
        throw Error('POINT_LIMIT');
    if (g.nodes.length > 100000 || g.edges.length > 160000)
        throw Error('GRAPH_LIMIT');
    const started = Date.now(), adj: number[][][] = g.nodes.map(() => []);
    for (const [a, b, stairs, dir] of g.edges) {
        const d = meters(g.nodes[a], g.nodes[b]);
        if (dir !== -1)
            adj[a].push([b, d, stairs]);
        if (dir !== 1)
            adj[b].push([a, d, stairs]);
    }
    const snaps = points.map(p => { let node = -1, distance = Infinity; g.nodes.forEach((n, i) => { const d = meters(p, n); if (d < distance) {
        node = i;
        distance = d;
    } }); if (distance > 80)
        throw Error('NO_NEARBY_PATH'); return { node, point: g.nodes[node], distanceMeters: Math.round(distance) }; });
    let total = 0, hasStairs = false;
    const path: number[] = [];
    for (let i = 1; i < snaps.length; i++) {
        const start = snaps[i - 1].node, end = snaps[i].node;
        if (start === end) {
            if (!path.length)
                path.push(start);
            continue;
        }
        const dist = new Float64Array(g.nodes.length).fill(Infinity), prev = new Int32Array(g.nodes.length).fill(-1), stairs = new Uint8Array(g.nodes.length), heap = new Heap();
        dist[start] = 0;
        heap.push([0, start]);
        let visited = 0;
        while (heap.a.length) {
            if (++visited % 1024 === 0 && Date.now() - started > 3000)
                throw Error('CALCULATION_LIMIT');
            const [d, u] = heap.pop();
            if (d !== dist[u])
                continue;
            if (u === end)
                break;
            for (const [v, w, st] of adj[u])
                if (d + w < dist[v]) {
                    dist[v] = d + w;
                    prev[v] = u;
                    stairs[v] = st;
                    heap.push([d + w, v]);
                }
        }
        if (!Number.isFinite(dist[end]))
            throw Error('NO_PATH');
        const leg: number[] = [];
        for (let u = end; u !== -1; u = prev[u]) {
            leg.push(u);
            hasStairs ||= !!stairs[u];
        }
        leg.reverse();
        path.push(...(path.length ? leg.slice(1) : leg));
        total += dist[end];
        if (path.length > 25000)
            throw Error('GEOMETRY_LIMIT');
    }
    if (total < 10)
        throw Error('POINTS_TOO_CLOSE');
    return { path: path.map(i => g.nodes[i]), distanceMeters: Math.round(total), estimatedMinutes: Math.ceil(total / 75), stairs: hasStairs, snaps };
}
export function walkingBounds(points: number[][]) { const lngs = points.map(p => p[0]), lats = points.map(p => p[1]); const west = Math.floor((Math.min(...lngs) - .006) * 100) / 100, east = Math.ceil((Math.max(...lngs) + .006) * 100) / 100, south = Math.floor((Math.min(...lats) - .006) * 100) / 100, north = Math.ceil((Math.max(...lats) + .006) * 100) / 100; if (north - south > .09 || east - west > .15 || south < -85 || north > 85 || west < -180 || east > 180)
    throw Error('AREA_LIMIT'); return { west, east, south, north }; }
