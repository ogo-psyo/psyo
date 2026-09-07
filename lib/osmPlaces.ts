import { withinPlaceBounds, type DiscoveredPlace, type PlaceBounds } from './placeDiscovery';
/** Allowlisted public OSM fields. Raw tags and private owner data never enter the catalog. */
export function normalizeOsmPlaces(elements: unknown[], bounds: PlaceBounds): DiscoveredPlace[] {
    const seen = new Set<string>();
    return elements.flatMap(raw => {
        if (!raw || typeof raw !== 'object') return [];
        const item = raw as Record<string, unknown>;
        if (!['node','way','relation'].includes(String(item.type)) || typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id < 1) return [];
        const tags = item.tags as Record<string, unknown> | undefined;
        if (!tags || tags.access === 'private' || tags.access === 'no') return [];
        let group: DiscoveredPlace['group'], category: string;
        if (tags.leisure === 'dog_park') { group='dogParks'; category='площадка для собак'; }
        else if (tags.leisure === 'park') { group='parks'; category='парк'; }
        else if (tags.amenity === 'veterinary') { group='vets'; category='ветклиника'; }
        else if (tags.shop === 'pet') { group='shops'; category='зоомагазин'; }
        else if (tags.shop === 'pet_grooming') { group='grooming'; category='груминг'; }
        else if (tags.amenity === 'cafe' || tags.amenity === 'restaurant') { group='cafes'; category=tags.amenity === 'cafe'?'кафе':'ресторан'; }
        else return [];
        const coordinate = item.type === 'node' ? item : item.center as Record<string, unknown> | undefined;
        if (!coordinate || typeof coordinate.lat !== 'number' || typeof coordinate.lon !== 'number' || !Number.isFinite(coordinate.lat) || !Number.isFinite(coordinate.lon)) return [];
        const point = {lat:coordinate.lat,lng:coordinate.lon};
        if (!withinPlaceBounds(point,bounds)) return [];
        const id=`osm-${item.type}-${item.id}`;
        if (seen.has(id)) return []; seen.add(id);
        const label = (v: unknown, max=240) => typeof v === 'string' ? v.trim().slice(0,max) : '';
        const title=label(tags['name:ru'])||label(tags.name)||`${category[0].toUpperCase()}${category.slice(1)} без названия`;
        const detail=[label(tags['addr:street']),label(tags['addr:housenumber']),label(tags['addr:city'])].filter(Boolean).join(', ');
        return [{id,title,detail,category,group,point,...(['yes','no','leashed'].includes(String(tags.dog))?{dogAccess:String(tags.dog)}:{}),...(item.type!=='node'?{pointIsCenter:true}:{})}];
    });
}
