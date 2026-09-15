import { distanceMeters } from './geo';
import type { SavedPlace } from './mapLibrary';
export type MeetingPreview = {
    kind: 'place' | 'route';
    origin?: 'selected-point';
    title: string;
    detail: string;
    points: number[][];
    sourceId: string;
    accuracyMeters?: number;
};
export function previewMeetingPlace(place: SavedPlace): MeetingPreview {
    return { kind: 'place', title: place.title, detail: place.accuracyMeters ? `Примерная область · около ${place.accuracyMeters} м` : place.detail, ...(place.accuracyMeters ? { accuracyMeters: place.accuracyMeters } : {}), points: [[place.point.lng, place.point.lat]], sourceId: place.id };
}
export function previewMeetingRoute(id: string, title: string, points: number[][]): MeetingPreview | null {
    if (points.length < 3)
        return null;
    const distance = (a: number[], b: number[]) => distanceMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
    // Only one contiguous middle excerpt. Rejoining multiple kept islands would invent a path.
    const runs: number[][][] = [];
    let run: number[][] = [];
    for (const point of points) {
        if (distance(point, points[0]) >= 500 && distance(point, points.at(-1)!) >= 500)
            run.push(point);
        else if (run.length) {
            runs.push(run);
            run = [];
        }
    }
    if (run.length)
        runs.push(run);
    const longest = runs.sort((a, b) => b.length - a.length)[0];
    if (!longest || longest.length < 2)
        return null;
    return { kind: 'route', title, detail: 'Фрагмент маршрута без частных начала и конца (не ближе 500 м)', points: longest, sourceId: id };
}

/** An explicitly selected meeting point is a proposal, not a private-library write.
 * Only these public fields can enter its snapshot; never copy arbitrary object fields.
 */
export function previewMeetingPoint(value: unknown): MeetingPreview | null {
    if (!value || typeof value !== 'object') return null;
    const point = value as Record<string, unknown>;
    if (typeof point.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(point.id)) return null;
    if (typeof point.title !== 'string' || !point.title.trim() || point.title.length > 160) return null;
    if (typeof point.lat !== 'number' || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || typeof point.lng !== 'number' || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) return null;
    return { kind: 'place', origin: 'selected-point', title: point.title.trim(), detail: 'Точка, выбранная для встречи', points: [[point.lng, point.lat]], sourceId: point.id };
}
