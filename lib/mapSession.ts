import {parseRoutePlanning,type RoutePlanning} from './routePlanning';
import { isValidGeoPoint } from './geo';
export type RouteFlow = 'idle' | 'recording' | 'paused' | 'gps-error' | 'record-review' | 'planning' | 'plan-review';
export type StoredRouteSession = {
    version: 3;
    petId: string;
    flow: Exclude<RouteFlow, 'idle' | 'gps-error'>;
    elapsedSeconds: number;
    points: number[][];
    updatedAt: number;
    startedAt?: number;
    title?: string;
    note?: string;
    editingRouteId?: string;
    gaps?: number[];
    planning?:RoutePlanning;
    calculationKey?:string;
};
export const routeSessionKey = (petId: string) => `pso.map.active-route.v3:${petId}`;
export const persistentFlows: RouteFlow[] = ['recording', 'paused', 'record-review', 'planning', 'plan-review'];
export function hasRouteWork(session: Pick<StoredRouteSession, 'points' | 'elapsedSeconds' | 'flow' | 'title' | 'note' | 'planning'>) {
    return session.points.length > 0 || Boolean(session.planning?.stops.length) || Boolean(session.title?.trim() || session.note?.trim())
        || (['recording', 'paused', 'record-review'].includes(session.flow) && session.elapsedSeconds > 0);
}
export function readRouteSession(raw: string | null, petId: string): StoredRouteSession | null {
    if (!raw)
        return null;
    try {
        const value = JSON.parse(raw) as StoredRouteSession;
        if (value.version !== 3 || value.petId !== petId || !persistentFlows.includes(value.flow) || !Array.isArray(value.points))
            return null;
        // Reject malformed geometry as a whole; never silently drop a user's points.
        if (value.points.some(p => !Array.isArray(p) || p.length < 2 || !isValidGeoPoint({ lng: p[0], lat: p[1] })))
            return null;
        const session = { ...value, planning:parseRoutePlanning(value.planning)||undefined, elapsedSeconds: Math.max(0, Number(value.elapsedSeconds) || 0) };
        return hasRouteWork(session) ? session : null;
    }
    catch {
        return null;
    }
}
export function moveRoutePoint(points: number[][], from: number, to: number) {
    if (from < 0 || to < 0 || from >= points.length || to >= points.length)
        return points;
    const next = points.map(p => [...p]);
    const [point] = next.splice(from, 1);
    next.splice(to, 0, point);
    return next;
}
export function closeRouteLoop(points: number[][]) {
    if (points.length < 2)
        return points;
    const first = points[0], last = points.at(-1)!;
    return first[0] === last[0] && first[1] === last[1] ? points : [...points, [...first]];
}
