import { distanceMeters, isValidGeoPoint } from './geo';
/** A break index is the first point after a GPS interruption. Never join it to its predecessor. */
export function validRouteGaps(value: unknown, length: number): number[] {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.filter((n): n is number => Number.isInteger(n) && n > 0 && n < length))].sort((a, b) => a - b);
}
export function splitRoute(points: number[][], gaps: number[] = []): number[][][] {
    const breaks = new Set(validRouteGaps(gaps, points.length));
    const segments: number[][][] = [];
    for (const [i, point] of points.entries()) {
        if (i === 0 || breaks.has(i))
            segments.push([]);
        segments.at(-1)!.push(point);
    }
    return segments;
}
export function measuredRouteDistance(points: number[][], gaps: number[] = []): number {
    return splitRoute(points, gaps).reduce((total, segment) => total + segment.slice(1).reduce((sum, p, i) => sum + distanceMeters({ lng: segment[i][0], lat: segment[i][1] }, { lng: p[0], lat: p[1] }), 0), 0);
}
export function routeEwkt(value: unknown): string | null {
    if (!Array.isArray(value) || value.length < 2 || value.some(p => !Array.isArray(p) || p.length !== 2 || !isValidGeoPoint({ lng: p[0], lat: p[1] })))
        return null;
    return `SRID=4326;LINESTRING(${value.map(p => `${p[0]} ${p[1]}`).join(', ')})`;
}
/** PostGIS may serialize geometry as GeoJSON or hex EWKB depending on PostgREST configuration. */
export function storedRoutePoints(value: unknown): number[][] | null {
    let points: unknown;
    if (value && typeof value === 'object' && !Array.isArray(value))
        points = (value as {
            coordinates?: unknown;
        }).coordinates;
    else if (typeof value === 'string') {
        const ewkt = value.match(/^(?:SRID=4326;)?LINESTRING\s*\(([^)]+)\)$/i);
        if (ewkt)
            points = ewkt[1].split(',').map(p => p.trim().split(/\s+/).map(Number));
        else if (value.startsWith('{')) {
            try {
                return storedRoutePoints(JSON.parse(value));
            }
            catch {
                return null;
            }
        }
        else if (/^(?:[0-9a-f]{2})+$/i.test(value) && value.length >= 18) {
            try {
                const bytes = Uint8Array.from(value.match(/../g)!, n => parseInt(n, 16));
                const view = new DataView(bytes.buffer);
                const little = view.getUint8(0) === 1;
                const type = view.getUint32(1, little);
                if ((type & 0xffff) !== 2)
                    return null;
                const srid = Boolean(type & 0x20000000);
                let offset = 5;
                if (srid) {
                    if (view.getUint32(offset, little) !== 4326)
                        return null;
                    offset += 4;
                }
                const count = view.getUint32(offset, little);
                offset += 4;
                const dimensions = 2 + (type & 0x80000000 ? 1 : 0) + (type & 0x40000000 ? 1 : 0);
                if (offset + count * dimensions * 8 !== bytes.length)
                    return null;
                const decoded: number[][] = [];
                for (let i = 0; i < count; i++) {
                    decoded.push([view.getFloat64(offset, little), view.getFloat64(offset + 8, little)]);
                    offset += dimensions * 8;
                }
                points = decoded;
            }
            catch {
                return null;
            }
        }
    }
    if (!Array.isArray(points) || points.length < 2 || points.some(p => !Array.isArray(p) || !isValidGeoPoint({ lng: p[0], lat: p[1] })))
        return null;
    return points.map(p => [p[0], p[1]]);
}
