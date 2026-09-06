import { measuredMapOperation } from '@/lib/server/mapMetrics';
import { takeMapSearchSlot } from '@/lib/server/mapSearchBudget';
type NominatimItem = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  category?: string;
};

const categoryLabels: Record<string, string> = {
  veterinary: 'ветклиника',
  pet: 'зоомагазин',
  pet_grooming: 'груминг',
  park: 'парк',
  dog_park: 'площадка для собак',
  cafe: 'кафе',
  restaurant: 'ресторан',
  pharmacy: 'аптека',
};

function finiteCoordinate(value: string | null, min: number, max: number) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request:Request){return measuredMapOperation('map_search',request,()=>search(request));}
async function search(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120);
  if (query.length < 2) return Response.json({ results: [] });

  const lat = finiteCoordinate(url.searchParams.get('lat'), -90, 90);
  const lng = finiteCoordinate(url.searchParams.get('lng'), -180, 180);
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '6',
    'accept-language': 'ru',
    addressdetails: '1',
  });
  const bounds=url.searchParams.get('bounds')?.split(',').map(Number);
  if(bounds&&bounds.length===4&&bounds.every(Number.isFinite)&&bounds[0]>=-90&&bounds[2]<=90&&bounds[1]>=-180&&bounds[3]<=180&&bounds[0]<bounds[2]&&bounds[1]<bounds[3]) {
    params.set('viewbox',`${bounds[1]},${bounds[2]},${bounds[3]},${bounds[0]}`);params.set('bounded','1');
  } else if (lat !== null && lng !== null) {
    const delta = 0.18;
    params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
    params.set('bounded', '1');
  }

  if(!await takeMapSearchSlot())return Response.json({results:[],error:'search_quota'}, {status:429,headers:{'Retry-After':'2'}});
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ru',
        'User-Agent': 'PsoApp/0.2 (https://pso-mvp.vercel.app)',
      },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 3600 },
    });
    if (response.status === 429) return Response.json({results:[],error:'search_quota'}, {status:429,headers:{'Retry-After':'60'}});
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    const payload = await response.json() as NominatimItem[];
    const results = payload.flatMap((item) => {
      const resultLat = finiteCoordinate(item.lat ?? null,-90,90);
      const resultLng = finiteCoordinate(item.lon ?? null,-180,180);
      if (resultLat===null || resultLng===null) return [];
      if(bounds&&bounds.length===4&&(resultLat<bounds[0]||resultLat>bounds[2]||resultLng<bounds[1]||resultLng>bounds[3]))return [];
      const fullTitle = (item.display_name || item.name || '').trim();
      if (!fullTitle) return [];
      const title = (item.name || fullTitle.split(',')[0]).trim();
      const detailParts = fullTitle.split(',').map((part) => part.trim()).filter(Boolean);
      if (detailParts[0]?.toLocaleLowerCase('ru-RU') === title.toLocaleLowerCase('ru-RU')) detailParts.shift();
      const detail = detailParts.slice(0, 3).join(', ');
      return [{
        id: `osm-${item.osm_type || "place"}-${item.osm_id || item.place_id || `${resultLat}-${resultLng}`}`,
        title,
        detail,
        kind: 'organization' as const,
        category: categoryLabels[item.type || ''] || categoryLabels[item.category || ''] || 'место',
        point: { lat: resultLat, lng: resultLng },
      }];
    });
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({ results: [], error: 'search_unavailable' }, { status: 503 });
  }
}
