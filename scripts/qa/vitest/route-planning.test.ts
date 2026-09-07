import { describe, it, expect } from 'vitest';
import { parseRoutePlanning, routeGpx } from '../../../lib/routePlanning';
import { readRouteSession } from '../../../lib/mapSession';
import { normalizeOwnerRoutes } from '../../../lib/mapUi';
import { buildWalkingGraph, solveWalkingGraph, walkingBounds, type OsmElement } from '../../../lib/walkingGraph';
const nodes: OsmElement[] = [{ type: 'node', id: 1, lon: 37, lat: 55 }, { type: 'node', id: 2, lon: 37.001, lat: 55 }, { type: 'node', id: 3, lon: 37.001, lat: 55.001 }, { type: 'node', id: 4, lon: 37, lat: 55.001 }];
const way = (id: number, ids: number[], tags: Record<string, string> = {}): OsmElement => ({ type: 'way', id, nodes: ids, tags: { highway: 'footway', ...tags } });
describe('pedestrian geometry is independent of stops', () => {
    it('follows connected bends instead of a straight segment and reports steps', () => { const g = buildWalkingGraph([...nodes, way(5, [1, 2]), way(6, [2, 3], { highway: 'steps' })]); const r = solveWalkingGraph(g, [[37, 55], [37.001, 55.001]]); expect(r.path).toEqual([[37, 55], [37.001, 55], [37.001, 55.001]]); expect(r.stairs).toBe(true); expect(r.distanceMeters).toBeGreaterThan(170); });
    it('does not silently cross private paths or disjoint components', () => { const g = buildWalkingGraph([...nodes, way(5, [1, 2]), way(6, [2, 3], { foot: 'private' }), way(7, [3, 4])]); expect(() => solveWalkingGraph(g, [[37, 55], [37.001, 55.001]])).toThrow('NO_PATH'); });
    it('honors pedestrian one-way and never inherits car one-way', () => { const g = buildWalkingGraph([...nodes, way(5, [1, 2], { oneway: 'yes' })]); expect(solveWalkingGraph(g, [[37.001, 55], [37, 55]]).path).toHaveLength(2); const directed = buildWalkingGraph([...nodes, way(5, [1, 2], { 'oneway:foot': 'yes' })]); expect(() => solveWalkingGraph(directed, [[37.001, 55], [37, 55]])).toThrow('NO_PATH'); });
    it('bounds automatic work while manual geometry remains independent', () => { expect(() => walkingBounds([[0, 0], [1, 1]])).toThrow('AREA_LIMIT'); expect(() => solveWalkingGraph(buildWalkingGraph([...nodes, way(5, [1, 2])]), [[0, 0], [37, 55]])).toThrow('NO_NEARBY_PATH'); });
});
describe('roundtrip / backwards compatibility', () => {
    const planning = { version: 1 as const, mode: 'walking' as const, stops: [{ point: [37, 55], title: 'Парк' }, { point: [37.001, 55.001], title: 'Дом' }] };
    it('keeps a stops-only unfinished draft and isolates dogs', () => { const raw = JSON.stringify({ version: 3, petId: 'dog', flow: 'planning', points: [], elapsedSeconds: 0, planning }); expect(readRouteSession(raw, 'dog')?.planning).toEqual(planning); expect(readRouteSession(raw, 'other')).toBe(null); });
    it('loads old route without inventing stops; loads new full geometry and metadata', () => { const base = { id: 'route', path: { type: 'LineString', coordinates: [[37, 55], [37.001, 55], [37.001, 55.001]] } }; expect(normalizeOwnerRoutes([base])[0].planning).toBeUndefined(); const r = normalizeOwnerRoutes([{ ...base, planning }])[0]; expect(r.path.coordinates).toHaveLength(3); expect(r.planning?.stops).toHaveLength(2); });
    it('rejects malformed stop coordinates instead of dropping them', () => { expect(parseRoutePlanning({ ...planning, stops: [{ point: ['37', 55] }] })).toBe(null); });
    it('GPX preserves GPS gaps and XML-escapes user names', () => { const xml = routeGpx('A&B', [[37, 55], [37.001, 55], [37.001, 55.001], [37, 55.001]], [2], planning.stops); expect(xml).toContain('A&amp;B'); expect(xml.match(/<trkseg>/g)).toHaveLength(2); expect(xml.match(/<trkpt /g)).toHaveLength(4); expect(xml.match(/<wpt /g)).toHaveLength(2); });
});
