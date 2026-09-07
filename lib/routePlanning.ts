import { isValidGeoPoint } from './geo';
import { measuredRouteDistance, splitRoute } from './routeGeometry';
export type RouteStop = {
    point: number[];
    title?: string;
};
export type RoutePlanning = {
    version: 1;
    mode: 'manual' | 'walking';
    stops: RouteStop[];
    stairs?: boolean;
    estimatedMinutes?: number;
};
export function parseRoutePlanning(value: unknown): RoutePlanning | null {
    if (!value || typeof value !== 'object')
        return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 1 || !['manual', 'walking'].includes(String(v.mode)) || !Array.isArray(v.stops) || v.stops.length > 10000)
        return null;
    const stops: RouteStop[] = [];
    for (const item of v.stops) {
        if (!item || typeof item !== 'object' || !Array.isArray(item.point) || item.point.length !== 2 || !item.point.every((n: unknown) => typeof n === 'number') || !isValidGeoPoint({ lng: item.point[0], lat: item.point[1] }))
            return null;
        stops.push({ point: [...item.point], ...(typeof item.title === 'string' ? { title: item.title.slice(0, 160) } : {}) });
    }
    return { version: 1, mode: v.mode as RoutePlanning['mode'], stops, ...(v.stairs === true ? { stairs: true } : {}), ...(typeof v.estimatedMinutes === 'number' && Number.isFinite(v.estimatedMinutes) && v.estimatedMinutes >= 0 ? { estimatedMinutes: Math.round(v.estimatedMinutes) } : {}) };
}
export const stopsKey = (stops: RouteStop[]) => JSON.stringify(stops.map(s => s.point));
export function routeGpx(title: string, points: number[][], gaps: number[] = [], stops: RouteStop[] = []) {
    const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
    return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Псё" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(title)}</name></metadata>${stops.map((s, i) => `<wpt lat="${s.point[1]}" lon="${s.point[0]}"><name>${esc(s.title || `Остановка ${i + 1}`)}</name></wpt>`).join('')}<trk><name>${esc(title)}</name>${splitRoute(points, gaps).map(segment => `<trkseg>${segment.map(p => `<trkpt lat="${p[1]}" lon="${p[0]}"/>`).join('')}</trkseg>`).join('')}</trk></gpx>`;
}
export function downloadRouteGpx(title: string, points: number[][], gaps: number[] = [], stops: RouteStop[] = []) { const url = URL.createObjectURL(new Blob([routeGpx(title, points, gaps, stops)], { type: 'application/gpx+xml' })); const a = document.createElement('a'); a.href = url; a.download = 'pso-walk.gpx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function walkingEstimate(points: number[][]) { return Math.ceil(measuredRouteDistance(points) / 75); }
