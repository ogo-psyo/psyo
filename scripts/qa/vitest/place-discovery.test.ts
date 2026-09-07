import { describe, it, expect } from 'vitest';
import { parsePlaceBounds, queryPlaceRegions, dogAccessLabel, type PlaceRegion } from '@/lib/placeDiscovery';
import { collectionPlaces, applyLibraryCommand, emptyMapLibrary } from '@/lib/mapLibrary';
import { parseRoutePlanning, routeGpx } from '@/lib/routePlanning';
import { normalizeOsmPlaces } from '@/lib/osmPlaces';
const bounds = { south: 55, west: 37, north: 56, east: 38 };
const region: PlaceRegion = { id: 'test', title: 'Контрольная область', bounds, updatedAt: '2026-09-07', sourceUrl: 'https://www.openstreetmap.org', places: [
    { id: 'osm-node-1', title: 'Парк', detail: '', category: 'парк', group: 'parks', point: { lat: 55.5, lng: 37.5 } },
    { id: 'osm-node-2', title: 'Клиника', detail: '', category: 'ветклиника', group: 'vets', point: { lat: 55, lng: 37 } },
    { id: 'osm-node-3', title: 'За границей', detail: '', category: 'парк', group: 'parks', point: { lat: 57, lng: 37.5 } },
] };
describe('geographic discovery contract', () => {
    it('imports only allowlisted public POIs and does not invent access or entrance data', () => {
        const raw={type:'way',id:5,center:{lat:55.5,lon:37.5},tags:{leisure:'park',name:'Парк',phone:'private contact',operator:'person'}};
        const result=normalizeOsmPlaces([raw,{...raw,id:6,tags:{...raw.tags,access:'private'}},{...raw,id:7,center:{lat:60,lon:37.5}}],bounds);
        expect(result).toHaveLength(1);expect(result[0].pointIsCenter).toBe(true);expect(result[0]).not.toHaveProperty('phone');expect(result[0]).not.toHaveProperty('operator');expect(result[0].dogAccess).toBeUndefined();
    });
    it('distinguishes invalid area, uncovered area and a genuinely empty category', () => {
        for (const v of [null, ',37,56,38', '56,37,55,38', '55,181,56,182', 'NaN,37,56,38']) expect(parsePlaceBounds(v)).toBeNull();
        expect(parsePlaceBounds('55,37,56,38')).toEqual(bounds);
        expect(queryPlaceRegions([region], { ...bounds, north: 57 }, 'parks')).toBeNull();
        expect(queryPlaceRegions([region], bounds, 'cafes')?.results).toEqual([]);
    });
    it('keeps boundary points, filters category and deduplicates public IDs', () => {
        expect(queryPlaceRegions([region, region], bounds, 'all')?.results.map(p => p.id)).toEqual(['osm-node-1','osm-node-2']);
        expect(queryPlaceRegions([region], bounds, 'vets')?.results.map(p => p.id)).toEqual(['osm-node-2']);
    });
    it('discloses capped extraction and never claims unknown dog access', () => {
        const many = { ...region, places: Array.from({ length: 95 }, (_, i) => ({ ...region.places[0], id: String(i) })) };
        const result = queryPlaceRegions([many], bounds, 'all');
        expect(result?.total).toBe(95); expect(result?.truncated).toBe(true); expect(result?.results).toHaveLength(80);
        expect(dogAccessLabel()).toContain('нет данных'); expect(dogAccessLabel('private')).toContain('нет данных'); expect(dogAccessLabel('no')).toContain('не разрешены');
    });
});
it('carries selected saved identities and names through route persistence without changing the collection', () => {
    let library = emptyMapLibrary();
    for (let i=0;i<3;i++) library = applyLibraryCommand(library, { id: 'command-'+i, kind: 'savePlace', collectionId: 'saved', place: {
        id: 'place-'+i, title: 'Остановка '+i, category: 'парк', detail: '', note: 'Частная заметка', point: { lat: 55+i/100, lng: 37 }, source: { provider: 'osm', id: 'osm-'+i },
    } });
    const before = JSON.stringify(library);
    const places = collectionPlaces(library,'saved',['place-2','place-0']);
    const stops = places.map(p=>({point:[p.point.lng,p.point.lat],title:p.title,placeId:p.id}));
    const parsed = parseRoutePlanning({version:1,mode:'manual',stops});
    expect(parsed?.stops.map(s=>s.placeId)).toEqual(['place-0','place-2']);
    expect(parsed?.stops[1].title).toBe('Остановка 2'); expect(JSON.stringify(library)).toBe(before);
    const gpx = routeGpx('Прогулка',stops.map(s=>s.point),[],stops);
    expect(gpx).toContain('Остановка 2'); expect(gpx).not.toContain('Частная заметка'); expect(gpx).not.toContain('place-2');
    expect(parseRoutePlanning({version:1,mode:'manual',stops:[{point:[37,55],placeId:{secret:true}}]})).toBeNull();
});
