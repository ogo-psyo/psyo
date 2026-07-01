export type GeoPoint = {
  lat: number;
  lng: number;
};

export type BlurredGeoPoint = GeoPoint & {
  radiusMeters: number;
};

const MIN_PUBLIC_RADIUS_METERS = 500;
const COORDINATE_PRECISION = 5;
const EARTH_RADIUS_METERS = 6371000;

export function isValidGeoPoint(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  return (
    Number.isFinite(point?.lat)
    && Number.isFinite(point?.lng)
    && Math.abs(Number(point?.lat)) <= 90
    && Math.abs(Number(point?.lng)) <= 180
  );
}

export function blurCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

export function blurCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  const distance = 100 + Math.random() * 200;
  const bearing = Math.random() * Math.PI * 2;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const angularDistance = distance / EARTH_RADIUS_METERS;

  const blurredLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance)
    + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const blurredLngRad = lngRad + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(blurredLatRad),
  );

  return {
    lat: blurCoordinate(blurredLatRad * 180 / Math.PI),
    lng: blurCoordinate(blurredLngRad * 180 / Math.PI),
  };
}

export function blurGeoPoint(point: GeoPoint, radiusMeters = MIN_PUBLIC_RADIUS_METERS): BlurredGeoPoint {
  const blurred = blurCoordinates(point.lat, point.lng);
  return {
    lat: blurred.lat,
    lng: blurred.lng,
    radiusMeters: Math.max(MIN_PUBLIC_RADIUS_METERS, Math.round(radiusMeters || MIN_PUBLIC_RADIUS_METERS)),
  };
}

export function bucketDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters)) return '> 5 km';
  if (distanceMeters < 1000) return '< 1 km';
  if (distanceMeters < 3000) return '1-3 km';
  if (distanceMeters < 5000) return '3-5 km';
  return '> 5 km';
}

export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isWithinRadius(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  radiusMeters: number,
) {
  if (!isValidGeoPoint({ lat: lat1, lng: lng1 }) || !isValidGeoPoint({ lat: lat2, lng: lng2 })) return false;
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) return false;
  return distanceMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) <= radiusMeters;
}

export function blurPublicZoneInput(input: {
  approximateLat?: number | string | null;
  approximateLng?: number | string | null;
  radiusMeters?: number | string | null;
  visibility?: string | null;
}) {
  const lat = Number(input.approximateLat);
  const lng = Number(input.approximateLng);
  const radiusMeters = Number(input.radiusMeters);
  if (!isValidGeoPoint({ lat, lng })) return null;

  if (input.visibility === 'public' || input.visibility === 'shared') {
    return blurGeoPoint({ lat, lng }, Number.isFinite(radiusMeters) ? radiusMeters : MIN_PUBLIC_RADIUS_METERS);
  }

  return {
    lat,
    lng,
    radiusMeters: Number.isFinite(radiusMeters) ? Math.round(radiusMeters) : MIN_PUBLIC_RADIUS_METERS,
  };
}
