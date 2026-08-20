export type OwnerRouteView = {
  id: string;
  petId?: string;
  type: 'route';
  title: string;
  description?: string;
  path: { type: 'LineString'; coordinates: number[][] };
  visibility: 'private' | 'shared';
  routeSource: 'recorded' | 'planned';
  startedAt?: string;
  durationSeconds?: number;
  distanceMeters?: number;
};

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

function routePath(value: unknown): OwnerRouteView['path'] | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length < 2) return null;
  const coordinates = candidate.coordinates
    .filter((point): point is unknown[] => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])])
    .filter((point) => point.every(Number.isFinite));
  if (coordinates.length < 2) return null;
  return { type: 'LineString', coordinates };
}

export function normalizeOwnerRoutes(value: unknown): OwnerRouteView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): OwnerRouteView[] => {
    if (!row || typeof row !== 'object') return [];
    const source = row as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const path = routePath(source.path);
    if (!id || !path) return [];
    const startedAt = typeof source.started_at === 'string' ? source.started_at : typeof source.startedAt === 'string' ? source.startedAt : undefined;
    const durationSeconds = finiteNonNegative(source.duration_seconds ?? source.durationSeconds);
    const distanceMeters = finiteNonNegative(source.distance_meters ?? source.distanceMeters);
    return [{
      id,
      petId: typeof source.pet_id === 'string' ? source.pet_id : typeof source.petId === 'string' ? source.petId : undefined,
      type: 'route',
      title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'Маршрут прогулки',
      description: typeof source.description === 'string' && source.description.trim() ? source.description.trim() : undefined,
      path,
      visibility: source.visibility === 'shared' ? 'shared' : 'private',
      routeSource: source.route_source === 'recorded' || source.routeSource === 'recorded' ? 'recorded' : 'planned',
      ...(startedAt ? { startedAt } : {}),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    }];
  });
}

export function upsertOwnerRoute(routes: OwnerRouteView[], route: OwnerRouteView) {
  const existingIndex = routes.findIndex((item) => item.id === route.id);
  if (existingIndex < 0) return [route, ...routes];
  return routes.map((item) => item.id === route.id ? route : item);
}

export function removeOwnerRoute(routes: OwnerRouteView[], routeId: string) {
  return routes.filter((item) => item.id !== routeId);
}
