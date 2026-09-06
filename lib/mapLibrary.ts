import { isValidGeoPoint } from './geo';
export type SavedPlace = {
    id: string;
    title: string;
    detail: string;
    category: string;
    point: {
        lat: number;
        lng: number;
    };
    source: {
        provider: 'osm' | 'pso' | 'user';
        id: string;
    };
    note: string;
    accuracyMeters?: number;
    unavailable?: boolean;
};
export type PlaceCollection = {
    id: string;
    title: string;
    placeIds: string[];
};
export type MapLibrary = {
    version: number;
    places: SavedPlace[];
    collections: PlaceCollection[];
    applied: string[];
};
export type LibraryCommand = {
    id: string;
    kind: 'createCollection';
    collectionId: string;
    title: string;
} | {
    id: string;
    kind: 'renameCollection';
    collectionId: string;
    title: string;
} | {
    id: string;
    kind: 'savePlace';
    place: SavedPlace;
    collectionId: string;
} | {
    id: string;
    kind: 'note';
    placeId: string;
    note: string;
} | {
    id: string;
    kind: 'membership';
    collectionId: string;
    placeId: string;
    present: boolean;
} | {
    id: string;
    kind: 'reorder';
    collectionId: string;
    placeIds: string[];
};
export const emptyMapLibrary = (): MapLibrary => ({ version: 0, places: [], collections: [{ id: 'saved', title: 'Сохранённые места', placeIds: [] }], applied: [] });
const text = (s: unknown, max: number) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
export function applyLibraryCommand(library: MapLibrary, command: LibraryCommand): MapLibrary {
    if (!command || !text(command.id, 128))
        throw new Error('INVALID_COMMAND');
    if (library.applied.includes(command.id))
        return library;
    const next = structuredClone(library);
    const collection = 'collectionId' in command ? next.collections.find(c => c.id === command.collectionId) : null;
    switch (command.kind) {
        case 'createCollection':
            if (!text(command.title, 120) || !text(command.collectionId, 128))
                throw new Error('INVALID_COLLECTION');
            if (!next.collections.some(c => c.id === command.collectionId))
                next.collections.push({ id: command.collectionId, title: command.title.trim(), placeIds: [] });
            break;
        case 'renameCollection':
            if (!collection || !text(command.title, 120))
                throw new Error('INVALID_COLLECTION');
            collection.title = command.title.trim();
            break;
        case 'savePlace': {
            const p = command.place;
            if (!collection || !p || (p.accuracyMeters !== undefined && (!Number.isFinite(p.accuracyMeters) || p.accuracyMeters < 0)) || !text(p.id, 128) || !text(p.title, 240) || !text(p.category, 120) || (p.unavailable !== undefined && typeof p.unavailable !== 'boolean') || !isValidGeoPoint(p.point) || !['osm', 'pso', 'user'].includes(p.source?.provider) || !text(p.source?.id, 180) || typeof p.note !== 'string' || p.note.length > 4000 || typeof p.detail !== 'string' || p.detail.length > 1500)
                throw new Error('INVALID_PLACE');
            // Provider reference is not the object's identity. The same place may belong to several collections.
            const existing = next.places.find(e => e.source.provider === p.source.provider && e.source.id === p.source.id);
            if (!existing && next.places.some(e => e.id === p.id))
                throw new Error('PLACE_ID_CONFLICT');
            const placeId = existing?.id || p.id;
            if (!existing)
                next.places.push({ ...p, title: p.title.trim() });
            if (!collection.placeIds.includes(placeId))
                collection.placeIds.push(placeId);
            break;
        }
        case 'note': {
            const place = next.places.find(p => p.id === command.placeId);
            if (!place || typeof command.note !== 'string' || command.note.length > 4000)
                throw new Error('INVALID_NOTE');
            place.note = command.note;
            break;
        }
        case 'membership':
            if (!collection || !next.places.some(p => p.id === command.placeId) || typeof command.present !== 'boolean')
                throw new Error('INVALID_MEMBERSHIP');
            if (command.present && !collection.placeIds.includes(command.placeId))
                collection.placeIds.push(command.placeId);
            if (!command.present)
                collection.placeIds = collection.placeIds.filter(id => id !== command.placeId);
            break;
        case 'reorder':
            if (!collection || !Array.isArray(command.placeIds) || command.placeIds.length !== collection.placeIds.length || new Set(command.placeIds).size !== command.placeIds.length || command.placeIds.some(id => !collection.placeIds.includes(id)))
                throw new Error('INVALID_ORDER');
            collection.placeIds = [...command.placeIds];
            break;
        default: throw new Error('UNKNOWN_COMMAND');
    }
    next.version++;
    next.applied = [...next.applied, command.id].slice(-256);
    return next;
}
export function collectionPoints(library: MapLibrary, id: string, selected?: string[]): number[][] {
    const collection = library.collections.find(c => c.id === id);
    if (!collection)
        return [];
    return collection.placeIds.filter(id => !selected || selected.includes(id)).flatMap(id => { const p = library.places.find(p => p.id === id); return p && !p.unavailable ? [[p.point.lng, p.point.lat]] : []; });
}
