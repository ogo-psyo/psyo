export type MapCoordinate = { lat: number; lng: number };

export type StoredMapFeature = {
  id: string;
  ownerId: string;
  petId: string | null;
  kind: 'point' | 'route';
  title: string;
  visibility: 'private' | 'shared' | 'public';
  areaLabel: string;
  approximateCenter?: MapCoordinate;
  exactPoint?: MapCoordinate;
  exactPath?: Array<[number, number]>;
  shareToken: string | null;
};

export type OwnerMapQuery = {
  ownerId: string;
  includePrivate: true;
};

export type ApproximateMapProjection = {
  id: string;
  kind: 'point' | 'route';
  title: string;
  areaLabel: string;
  approximateCenter?: MapCoordinate;
};

export function listOwnerMapFeatures(features: StoredMapFeature[], query: OwnerMapQuery) {
  return features.filter((feature) => feature.ownerId === query.ownerId);
}

export function projectExternalMapFeature(feature: StoredMapFeature): ApproximateMapProjection {
  return {
    id: feature.id,
    kind: feature.kind,
    title: feature.title,
    areaLabel: feature.areaLabel,
    ...(feature.approximateCenter ? { approximateCenter: feature.approximateCenter } : {}),
  };
}

export function resolveSharedMapFeature(features: StoredMapFeature[], shareToken: string | null) {
  if (!shareToken) return null;
  const feature = features.find((candidate) => (
    candidate.visibility === 'shared'
    && candidate.shareToken === shareToken
  ));
  return feature ? projectExternalMapFeature(feature) : null;
}

export function revokeSharedMapFeature(
  features: StoredMapFeature[],
  input: { ownerId: string; id: string },
) {
  const owned = features.find((feature) => feature.id === input.id && feature.ownerId === input.ownerId);
  if (!owned) throw new Error('map feature not found');
  return features.map((feature) => feature.id === input.id
    ? { ...feature, visibility: 'private' as const, shareToken: null }
    : feature);
}
