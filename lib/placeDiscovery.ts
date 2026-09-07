/** Public regional POIs only; never includes an owner's saved/private places. */
export const placeCategories = {
    all: 'Все места', parks: 'Парки', dogParks: 'Площадки', vets: 'Ветклиники',
    shops: 'Зоомагазины', grooming: 'Груминг', cafes: 'Кафе и рестораны',
} as const;
export type PlaceCategory = keyof typeof placeCategories;
export type PlaceBounds = { south: number; west: number; north: number; east: number };
export type DiscoveredPlace = {
    id: string; title: string; detail: string; category: string;
    group: Exclude<PlaceCategory, 'all'>;
    point: { lat: number; lng: number };
    dogAccess?: string; pointIsCenter?: boolean;
};
export type PlaceRegion = {
    id: string; title: string; bounds: PlaceBounds; updatedAt: string;
    sourceUrl: string; places: DiscoveredPlace[];
};
export type DiscoveryResponse = {
    results: DiscoveredPlace[]; bounds: PlaceBounds; category: PlaceCategory;
    total: number; truncated: boolean; updatedAt: string; source: 'OpenStreetMap';
    coverage: { id: string; title: string }[];
};
export const DISCOVERY_LIMIT = 80;
export function parsePlaceBounds(raw: string | null): PlaceBounds | null {
    const parts = raw?.split(',');
    if (!parts || parts.length !== 4 || parts.some(s => !s.trim())) return null;
    const [south, west, north, east] = parts.map(Number);
    if (![south, west, north, east].every(Number.isFinite) || south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
    return { south, west, north, east };
}
export const withinPlaceBounds = (p: { lat: number; lng: number }, b: PlaceBounds) => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
export function queryPlaceRegions(regions: PlaceRegion[], bounds: PlaceBounds, category: PlaceCategory): DiscoveryResponse | null {
    // A coverage gap is not an empty result; require a documented region containing the view.
    const covered = regions.filter(r => withinPlaceBounds({ lat: bounds.south, lng: bounds.west }, r.bounds) && withinPlaceBounds({ lat: bounds.north, lng: bounds.east }, r.bounds));
    if (!covered.length) return null;
    const seen = new Set<string>();
    const results = covered.flatMap(r => r.places).filter(p => {
        if (seen.has(p.id) || !withinPlaceBounds(p.point, bounds) || (category !== 'all' && p.group !== category)) return false;
        seen.add(p.id); return true;
    });
    const lat = (bounds.north + bounds.south) / 2, lng = (bounds.east + bounds.west) / 2;
    const distance = (p: DiscoveredPlace) => (p.point.lat - lat) ** 2 + ((p.point.lng - lng) * Math.cos(lat * Math.PI / 180)) ** 2;
    results.sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
    return { results: results.slice(0, DISCOVERY_LIMIT), total: results.length, truncated: results.length > DISCOVERY_LIMIT, bounds, category,
        updatedAt: covered.map(r => r.updatedAt).sort()[0], source: 'OpenStreetMap', coverage: covered.map(({ id, title }) => ({ id, title })) };
}
export function dogAccessLabel(value?: string): string {
    return ({ yes: 'Собаки разрешены по данным OSM', no: 'Собаки не разрешены по данным OSM', leashed: 'С собакой на поводке по данным OSM' } as Record<string, string>)[value || ''] || 'Условия посещения с собакой: нет данных';
}
