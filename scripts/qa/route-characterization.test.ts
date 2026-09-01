import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = {
  ownerA: '00000000-0000-4000-8000-00000000000a',
  ownerB: '00000000-0000-4000-8000-00000000000b',
  petA: '10000000-0000-4000-8000-00000000000a',
  petB: '10000000-0000-4000-8000-00000000000b',
};

const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email?: string | null; user_metadata?: Record<string, unknown> }, supabase: null as any, token: null as string | null },
  appSession: null as null | { ownerId: string; psyoUserId: string; verifiedTelegramContact: { username: string | null } },
  admin: null as any,
}));

vi.mock('@/lib/server/auth', () => ({
  getRequestAuth: vi.fn(async () => state.auth),
}));

vi.mock('@/lib/server/appSession', () => ({
  getAppSessionFromRequest: vi.fn(() => state.appSession),
}));

vi.mock('@/lib/server/supabase', () => ({
  demoModeResponse: vi.fn((message: string) => ({ mode: 'demo', message })),
  getSupabaseAdmin: vi.fn(() => state.admin),
}));

const careRoute = await import('@/app/api/reminders/route');
const socialRoute = await import('@/app/api/social/profile/route');
const v1PetsRoute = await import('@/app/api/v1/pets/route');
const mapFeaturesRoute = await import('@/app/api/map/features/route');

type QueryResult = { data?: unknown; error?: { message: string; code?: string } | null; count?: number };
type TablePlan = QueryResult & { maybeSingle?: QueryResult; single?: QueryResult };

class FakeQuery {
  filters: Array<{ op: string; field: string; value: unknown }> = [];
  writes: Array<{ op: string; value: unknown; options?: unknown }> = [];

  constructor(
    readonly table: string,
    readonly plan: TablePlan,
    readonly calls: unknown[],
  ) {}

  select() { return this; }
  order() { return this; }
  range() { return this; }
  limit() { return this; }
  gte(field: string, value: unknown) { this.filters.push({ op: 'gte', field, value }); return this; }
  lte(field: string, value: unknown) { this.filters.push({ op: 'lte', field, value }); return this; }
  lt(field: string, value: unknown) { this.filters.push({ op: 'lt', field, value }); return this; }
  gt(field: string, value: unknown) { this.filters.push({ op: 'gt', field, value }); return this; }
  neq(field: string, value: unknown) { this.filters.push({ op: 'neq', field, value }); return this; }
  in(field: string, value: unknown) { this.filters.push({ op: 'in', field, value }); return this; }
  or(value: unknown) { this.filters.push({ op: 'or', field: 'or', value }); return this; }
  is(field: string, value: unknown) { this.filters.push({ op: 'is', field, value }); return this; }
  eq(field: string, value: unknown) { this.filters.push({ op: 'eq', field, value }); return this; }
  insert(value: unknown) { this.writes.push({ op: 'insert', value }); return this; }
  update(value: unknown) { this.writes.push({ op: 'update', value }); return this; }
  upsert(value: unknown, options?: unknown) { this.writes.push({ op: 'upsert', value, options }); return this; }
  delete() { this.writes.push({ op: 'delete', value: null }); return this; }
  maybeSingle() { return Promise.resolve(this.plan.maybeSingle ?? this.plan); }
  single() { return Promise.resolve(this.plan.single ?? this.plan); }
  then(resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) {
    return Promise.resolve(this.plan).then(resolve, reject);
  }
}

function fakeSupabase(input: {
  tables?: Record<string, TablePlan | TablePlan[]>;
  rpc?: Record<string, QueryResult>;
}) {
  const calls: any[] = [];
  const tableCounters = new Map<string, number>();
  return {
    calls,
    from(table: string) {
      const tablePlan = input.tables?.[table] ?? { data: [], error: null };
      const index = tableCounters.get(table) ?? 0;
      tableCounters.set(table, index + 1);
      const plan = Array.isArray(tablePlan) ? tablePlan[Math.min(index, tablePlan.length - 1)] : tablePlan;
      const query = new FakeQuery(table, plan, calls);
      calls.push({ table, query });
      return query;
    },
    rpc(name: string, args: unknown) {
      calls.push({ rpc: name, args });
      return Promise.resolve(input.rpc?.[name] ?? { data: null, error: null });
    },
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1${path}`, {
    ...init,
    headers: {
      origin: 'http://127.0.0.1',
      ...(init.headers ?? {}),
    },
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

function expectResponse(response: Response | undefined) {
  expect(response).toBeDefined();
  return response as Response;
}

function bearer(ownerId = ids.ownerA, supabase: any = fakeSupabase({})) {
  state.auth = { user: { id: ownerId, email: null, user_metadata: {} }, supabase, token: 'token' };
  return supabase;
}

function appSession(ownerId = ids.ownerA) {
  state.appSession = { ownerId, psyoUserId: `tg-${ownerId}`, verifiedTelegramContact: { username: 'owner_a' } };
}

beforeEach(() => {
  state.auth = { user: null, supabase: null, token: null };
  state.appSession = null;
  state.admin = null;
});

describe('care reminders route characterization', () => {
  it.each([
    ['bearer only', () => bearer()],
    ['app-session only', () => appSession()],
    ['matching principals', () => { bearer(); appSession(); }],
  ])('GET accepts %s and scopes query by owner', async (_name, arrange) => {
    const supabase = fakeSupabase({ tables: { reminders: { data: [{ id: 'r1', pet_id: ids.petA, title: 'Vet', type: 'custom', due_at: '2026-09-01T10:00:00.000Z', recurrence: 'none', status: 'active', completed_at: null, snoozed_until: null, next_due_at: null }], error: null } } });
    state.admin = supabase;
    arrange();
    if (state.auth.user) state.auth.supabase = supabase;
    const response = await careRoute.GET(request(`/api/reminders?petId=${ids.petA}`));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ mode: 'user' });
    const reminders = supabase.calls.find((call) => call.table === 'reminders').query;
    expect(reminders.filters).toContainEqual({ op: 'eq', field: 'pets.owner_id', value: ids.ownerA });
  });

  it('GET currently allows principal conflict and keeps bearer owner precedence', async () => {
    const supabase = fakeSupabase({ tables: { reminders: { data: [], error: null } } });
    bearer(ids.ownerA, supabase);
    appSession(ids.ownerB);
    state.admin = supabase;
    const response = await careRoute.GET(request('/api/reminders'));
    expect(response.status).toBe(200);
    const reminders = supabase.calls.find((call) => call.table === 'reminders').query;
    expect(reminders.filters).toContainEqual({ op: 'eq', field: 'pets.owner_id', value: ids.ownerA });
  });

  it('GET returns 401 without auth and does not query storage', async () => {
    const supabase = fakeSupabase({ tables: { reminders: { data: [], error: null } } });
    state.admin = supabase;
    const response = await careRoute.GET(request('/api/reminders'));
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: 'AUTH_REQUIRED' });
    expect(supabase.calls).toHaveLength(0);
  });

  it('POST captures invalid JSON, foreign pet RPC, storage unavailable, and storage failure envelopes', async () => {
    expect((await careRoute.POST(request('/api/reminders', { method: 'POST', body: '{' }))).status).toBe(400);

    const foreign = fakeSupabase({ rpc: { care_create_reminder_atomic: { data: null, error: { message: 'PET_NOT_FOUND' } } } });
    state.admin = foreign;
    appSession();
    const foreignResponse = await careRoute.POST(request('/api/reminders', {
      method: 'POST',
      headers: { 'idempotency-key': 'reminder-key-1' },
      body: JSON.stringify({ petId: ids.petB, title: 'Vet', dueAt: '2026-09-01T10:00:00.000Z' }),
    }));
    expect(foreignResponse.status).toBe(404);
    expect(await json(foreignResponse)).toMatchObject({ error: 'PET_NOT_FOUND' });

    state.admin = null;
    const demoResponse = await careRoute.POST(request('/api/reminders', {
      method: 'POST',
      headers: { 'idempotency-key': 'reminder-key-2' },
      body: JSON.stringify({ petId: ids.petA, title: 'Vet', dueAt: '2026-09-01T10:00:00.000Z' }),
    }));
    expect(demoResponse.status).toBe(201);

    const failing = fakeSupabase({ rpc: { care_create_reminder_atomic: { data: null, error: { message: 'database unavailable' } } } });
    state.admin = failing;
    const failureResponse = await careRoute.POST(request('/api/reminders', {
      method: 'POST',
      headers: { 'idempotency-key': 'reminder-key-3' },
      body: JSON.stringify({ petId: ids.petA, title: 'Vet', dueAt: '2026-09-01T10:00:00.000Z' }),
    }));
    expect(failureResponse.status).toBe(500);
    expect(await json(failureResponse)).toMatchObject({ error: 'CARE_SAVE_FAILED' });
  });
});

describe('social profile route characterization', () => {
  const socialTables = {
    pets: { maybeSingle: { data: { id: ids.petA, owner_id: ids.ownerA, name: 'Mia', avatar_url: null }, error: null } },
    social_discovery_profiles: { maybeSingle: { data: null, error: null }, single: { data: { pet_id: ids.petA, discoverable: false, city: 'tbilisi', district: null, coarse_lat: null, coarse_lng: null, scenarios: [] }, error: null } },
  };

  it.each([
    ['bearer only', () => bearer()],
    ['app-session only', () => appSession()],
    ['matching principals', () => { bearer(); appSession(); }],
  ])('GET accepts %s and scopes pet lookup by owner', async (_name, arrange) => {
    const supabase = fakeSupabase({ tables: socialTables });
    state.admin = supabase;
    arrange();
    const response = expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petA}`)));
    expect(response.status).toBe(200);
    const pets = supabase.calls.find((call) => call.table === 'pets')?.query as FakeQuery | undefined;
    expect(pets).toBeDefined();
    if (!pets) throw new Error('pets query was not called');
    expect(pets.filters).toContainEqual({ op: 'eq', field: 'owner_id', value: ids.ownerA });
  });

  it('rejects principal conflict with current 401 envelope before storage', async () => {
    const supabase = fakeSupabase({ tables: socialTables });
    state.admin = supabase;
    bearer(ids.ownerA);
    appSession(ids.ownerB);
    const response = expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petA}`)));
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: 'IDENTITY_PRINCIPAL_MISMATCH' });
    expect(supabase.calls).toHaveLength(0);
  });

  it('captures no auth, foreign pet, storage unavailable, storage failure, and invalid JSON', async () => {
    state.admin = fakeSupabase({ tables: socialTables });
    expect(expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petA}`))).status).toBe(401);

    appSession();
    state.admin = fakeSupabase({ tables: { ...socialTables, pets: { maybeSingle: { data: null, error: null } } } });
    const foreign = expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petB}`)));
    expect(foreign.status).toBe(404);
    expect(await json(foreign)).toMatchObject({ error: 'PET_NOT_FOUND' });

    state.admin = null;
    const unavailable = expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petA}`)));
    expect(unavailable.status).toBe(503);
    expect(await json(unavailable)).toMatchObject({ error: 'SOCIAL_STORAGE_UNAVAILABLE' });

    state.admin = fakeSupabase({ tables: { ...socialTables, pets: { maybeSingle: { data: null, error: { message: 'down' } } } } });
    const failure = expectResponse(await socialRoute.GET(request(`/api/social/profile?petId=${ids.petA}`)));
    expect(failure.status).toBe(500);
    expect(await json(failure)).toMatchObject({ error: 'SOCIAL_STORAGE_FAILED' });

    state.admin = fakeSupabase({ tables: socialTables });
    const invalid = expectResponse(await socialRoute.PUT(request('/api/social/profile', { method: 'PUT', body: '{' })));
    expect(invalid.status).toBe(400);
    expect(await json(invalid)).toMatchObject({ error: 'PET_ID_REQUIRED' });
  });
});

describe('v1 pets route characterization', () => {
  it.each([
    ['bearer only', () => bearer()],
    ['app-session only', () => appSession()],
    ['matching principals', () => { bearer(); appSession(); }],
  ])('PATCH accepts %s and scopes active pet by owner', async (_name, arrange) => {
    const supabase = fakeSupabase({ tables: {
      pets: { maybeSingle: { data: { id: ids.petA }, error: null } },
      profiles: { error: null },
    } });
    state.admin = supabase;
    arrange();
    if (state.auth.user) state.auth.supabase = supabase;
    const response = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petA }) }));
    expect(response.status).toBe(200);
    const pets = supabase.calls.find((call) => call.table === 'pets').query;
    expect(pets.filters).toContainEqual({ op: 'eq', field: 'owner_id', value: ids.ownerA });
  });

  it('PATCH currently allows principal conflict and keeps bearer owner precedence', async () => {
    const supabase = fakeSupabase({ tables: {
      pets: { maybeSingle: { data: { id: ids.petA }, error: null } },
      profiles: { error: null },
    } });
    bearer(ids.ownerA, supabase);
    appSession(ids.ownerB);
    state.admin = supabase;
    const response = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petA }) }));
    expect(response.status).toBe(200);
    const pets = supabase.calls.find((call) => call.table === 'pets').query;
    expect(pets.filters).toContainEqual({ op: 'eq', field: 'owner_id', value: ids.ownerA });
  });

  it('PATCH captures validation, no auth, foreign pet, storage unavailable, and storage failure envelopes', async () => {
    expect((await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: '{' }))).status).toBe(400);

    state.admin = fakeSupabase({});
    const noAuth = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petA }) }));
    expect(noAuth.status).toBe(401);
    expect(await json(noAuth)).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });

    appSession();
    state.admin = null;
    const unavailable = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petA }) }));
    expect(unavailable.status).toBe(503);
    expect(await json(unavailable)).toMatchObject({ code: 'STORAGE_REQUIRED', status: 503 });

    state.admin = fakeSupabase({ tables: { pets: { maybeSingle: { data: null, error: null } } } });
    const foreign = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petB }) }));
    expect(foreign.status).toBe(404);
    expect(await json(foreign)).toMatchObject({ error: 'PET_NOT_FOUND' });

    state.admin = fakeSupabase({ tables: { pets: { maybeSingle: { data: null, error: { message: 'down' } } } } });
    const failure = await v1PetsRoute.PATCH(request('/api/v1/pets', { method: 'PATCH', body: JSON.stringify({ activePetId: ids.petA }) }));
    expect(failure.status).toBe(500);
    expect(await json(failure)).toMatchObject({ error: 'down' });
  });
});

describe('map features route characterization', () => {
  it.each([
    ['bearer only', () => bearer()],
    ['app-session only', () => appSession()],
    ['matching principals', () => { bearer(); appSession(); }],
  ])('POST accepts %s and scopes pet lookup by owner', async (_name, arrange) => {
    const supabase = fakeSupabase({ tables: {
      pets: { maybeSingle: { data: { id: ids.petA }, error: null } },
      map_zones: { single: { data: { id: 'zone-1', share_token: null }, error: null } },
    } });
    state.admin = supabase;
    arrange();
    const response = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 41.715, lng: 44.827, visibility: 'private' }),
    }));
    expect(response.status).toBe(201);
    const pets = supabase.calls.find((call) => call.table === 'pets').query;
    expect(pets.filters).toContainEqual({ op: 'eq', field: 'owner_id', value: ids.ownerA });
  });

  it('POST currently allows principal conflict and keeps bearer owner precedence', async () => {
    const supabase = fakeSupabase({ tables: {
      pets: { maybeSingle: { data: { id: ids.petA }, error: null } },
      map_zones: { single: { data: { id: 'zone-1', share_token: null }, error: null } },
    } });
    state.admin = supabase;
    bearer(ids.ownerA);
    appSession(ids.ownerB);
    const response = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 41.715, lng: 44.827 }),
    }));
    expect(response.status).toBe(201);
    const pets = supabase.calls.find((call) => call.table === 'pets').query;
    expect(pets.filters).toContainEqual({ op: 'eq', field: 'owner_id', value: ids.ownerA });
  });

  it('POST captures no auth, foreign pet, storage unavailable, invalid point, and storage failure envelopes', async () => {
    state.admin = fakeSupabase({});
    const noAuth = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 41.715, lng: 44.827 }),
    }));
    expect(noAuth.status).toBe(401);
    expect(await json(noAuth)).toMatchObject({ error: 'AUTH_REQUIRED' });

    appSession();
    state.admin = null;
    const unavailable = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 41.715, lng: 44.827 }),
    }));
    expect(unavailable.status).toBe(503);
    expect(await json(unavailable)).toMatchObject({ error: 'SUPABASE_NOT_CONFIGURED' });

    state.admin = fakeSupabase({ tables: { pets: { maybeSingle: { data: null, error: null } } } });
    const foreign = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petB, title: 'Park', lat: 41.715, lng: 44.827 }),
    }));
    expect(foreign.status).toBe(404);
    expect(await json(foreign)).toMatchObject({ error: 'PET_NOT_FOUND' });

    state.admin = fakeSupabase({ tables: { pets: { maybeSingle: { data: { id: ids.petA }, error: null } } } });
    const invalid = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 99, lng: 44.827 }),
    }));
    expect(invalid.status).toBe(400);
    expect(await json(invalid)).toMatchObject({ error: 'valid lat/lng are required' });

    state.admin = fakeSupabase({ tables: {
      pets: { maybeSingle: { data: { id: ids.petA }, error: null } },
      map_zones: { single: { data: null, error: { message: 'insert failed' } } },
    } });
    const failure = await mapFeaturesRoute.POST(request('/api/map/features', {
      method: 'POST',
      body: JSON.stringify({ type: 'point', petId: ids.petA, title: 'Park', lat: 41.715, lng: 44.827 }),
    }));
    expect(failure.status).toBe(500);
    expect(await json(failure)).toMatchObject({ error: 'insert failed' });
  });
});
