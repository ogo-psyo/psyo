export type GuestEntityState = {
  reminders: unknown[];
  wishlist: unknown[];
  zones: unknown[];
  routes: unknown[];
};

const emptyGuestEntityState = (): GuestEntityState => ({
  reminders: [],
  wishlist: [],
  zones: [],
  routes: [],
});

function safePetScope(petId?: string) {
  return (petId || 'guest').replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 160);
}

export function guestEntityStorageKey(petId?: string) {
  return `pso.product.entities.v1:${safePetScope(petId)}`;
}

export function loadGuestEntityState(storage: Storage, petId?: string): GuestEntityState {
  try {
    const raw = storage.getItem(guestEntityStorageKey(petId));
    if (!raw) return emptyGuestEntityState();
    const parsed = JSON.parse(raw) as Partial<GuestEntityState>;
    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
    };
  } catch {
    storage.removeItem(guestEntityStorageKey(petId));
    return emptyGuestEntityState();
  }
}

export function saveGuestEntityState(storage: Storage, petId: string | undefined, state: GuestEntityState) {
  storage.setItem(guestEntityStorageKey(petId), JSON.stringify(state));
}

export function resetGuestEntityStorage(storage: Storage, petId?: string) {
  storage.removeItem(guestEntityStorageKey(petId));
}

export function resetAllLocalPsoData(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith('pso.')));
  keys.forEach((key) => storage.removeItem(key));
}
