type NominatimItem = {
  place_id?: number;
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
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
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
  if (lat !== null && lng !== null) {
    const delta = 0.18;
    params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
    params.set('bounded', '0');
  }

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
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    const payload = await response.json() as NominatimItem[];
    const results = payload.flatMap((item) => {
      const resultLat = Number(item.lat);
      const resultLng = Number(item.lon);
      if (!Number.isFinite(resultLat) || !Number.isFinite(resultLng)) return [];
      const fullTitle = (item.display_name || item.name || '').trim();
      if (!fullTitle) return [];
      const title = (item.name || fullTitle.split(',')[0]).trim();
      const detailParts = fullTitle.split(',').map((part) => part.trim()).filter(Boolean);
      if (detailParts[0]?.toLocaleLowerCase('ru-RU') === title.toLocaleLowerCase('ru-RU')) detailParts.shift();
      const detail = detailParts.slice(0, 3).join(', ');
      return [{
        id: `osm-${item.place_id || `${resultLat}-${resultLng}`}`,
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
