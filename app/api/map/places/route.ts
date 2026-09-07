import catalog from '@/data/map-places/catalog.json';
import { parsePlaceBounds, placeCategories, queryPlaceRegions, type PlaceCategory, type PlaceRegion } from '@/lib/placeDiscovery';
import { measuredMapOperation } from '@/lib/server/mapMetrics';

/** Owned regional extract. No camera-triggered queries to a public OSM backend. */
export async function GET(request: Request) {
    return measuredMapOperation('place_discovery', request, async () => {
        const url = new URL(request.url), bounds = parsePlaceBounds(url.searchParams.get('bounds'));
        const category = url.searchParams.get('category') || 'all';
        if (!bounds || !Object.hasOwn(placeCategories, category)) return Response.json({ error: 'INVALID_QUERY' }, { status: 400 });
        if (bounds.north - bounds.south > 0.3 || bounds.east - bounds.west > 0.5) return Response.json({ error: 'AREA_LIMIT' }, { status: 422 });
        const regions = catalog.regions as PlaceRegion[];
        const result = queryPlaceRegions(regions, bounds, category as PlaceCategory);
        if (!result) return Response.json({ error: 'AREA_NOT_COVERED', coverage: regions.map(({ id, title, bounds }) => ({ id, title, bounds })) }, { status: 422 });
        return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } });
    });
}
