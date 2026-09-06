import { distanceMeters, type GeoPoint } from './geo';
import type { OwnerRouteView } from './mapUi';
import { measuredRouteDistance } from './routeGeometry';
export const durationWalkLimits = { startMeters: 150, closureMeters: 40, toleranceRatio: .2, maxMinutesDifference: 5, maxCandidates: 500, speedKmh: 4 } as const;
export function findDurationWalk(routes: OwnerRouteView[], start: GeoPoint, minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180)
        return null;
    const differenceLimit = Math.min(durationWalkLimits.maxMinutesDifference, minutes * durationWalkLimits.toleranceRatio);
    return routes.slice(0, durationWalkLimits.maxCandidates).flatMap(route => {
        if (route.routeSource !== 'recorded' || route.pathGaps?.length)
            return [];
        const points = route.path.coordinates;
        if (points.length < 3)
            return [];
        const first = { lng: points[0][0], lat: points[0][1] }, last = { lng: points.at(-1)![0], lat: points.at(-1)![1] };
        const startMeters = distanceMeters(start, first);
        if (startMeters > durationWalkLimits.startMeters || distanceMeters(first, last) > durationWalkLimits.closureMeters)
            return [];
        const estimatedMinutes = measuredRouteDistance(points) / 1000 / durationWalkLimits.speedKmh * 60;
        const difference = Math.abs(estimatedMinutes - minutes);
        if (difference > differenceLimit)
            return [];
        return [{ route, estimatedMinutes: Math.round(estimatedMinutes), startMeters: Math.round(startMeters), difference }];
    }).sort((a, b) => a.difference - b.difference || a.startMeters - b.startMeters)[0] || null;
}
