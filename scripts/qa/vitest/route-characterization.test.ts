import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

type Result = { data: unknown; error: { message: string } | null };
type Call = { table: string; method: string; args: unknown[] };
type Query = PromiseLike<Result> & {
  delete: () => Query;
  eq: (...args: unknown[]) => Query;
  gt: (...args: unknown[]) => Query;
  gte: (...args: unknown[]) => Query;
  insert: (...args: unknown[]) => Query;
  lt: (...args: unknown[]) => Query;
  lte: (...args: unknown[]) => Query;
  maybeSingle: () => Query;
  neq: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  select: (...args: unknown[]) => Query;
  single: () => Query;
  upsert: (...args: unknown[]) => Query;
};

const state = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, supabase: null as SupabaseClient | null, token: null as string | null },
  session: null as { ownerId?: string; verifiedTelegramContact?: { username: string | null } } | null,
  admin: null as SupabaseClient | null,
}));

vi.mock('@/lib/server/auth', () => ({
  getRequestAuth: vi.fn(async () => state.auth),
}));

vi.mock('@/lib/server/appSession', () => ({
  getAppSessionFromRequest: vi.fn(() => state.session),
}));

vi.mock('@/lib/server/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/supabase')>();
  return { ...actual, getSupabaseAdmin: vi.fn(() => state.admin) };
});

import { GET as getReminders, POST as postReminder } from '@/app/api/reminders/route';
import { GET as getSocialProfile, PUT as putSocialProfile } from '@/app/api/social/profile/route';
import { PATCH as patchPet } from '@/app/api/v1/pets/route';
import { POST as postMapFeature } from '@/app/api/map/features/route';

function makeQuery(table: string, result: Result, calls: Call[]): Query {
  const query = {
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  } as unknown as Query;
  for (const method of ['delete', 'eq', 'gt', 'gte', 'insert', 'lt', 'lte', 'maybeSingle', 'neq', 'order', 'select', 'single', 'upsert'] as const) {
    query[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return query;
    };
  }
  return query;
}

function fakeSupabase(results: Record<string, Result>) {
  const calls: Call[] = [];
  const fallback = { data: null, error: null };
  const client = {
    from(table: string) {
      calls.push({ table, method: 'from', args: [] });
      return makeQuery(table, results[table] ?? fallback, calls);
    },
    rpc(name: string, args: unknown) {
      calls.push({ table: 'rpc', method: name, args: [args] });
      return Promise.resolve(results[`rpc:${name}`] ?? fallback);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function request(path: string, init?: RequestInit & { json?: unknown }) {
  const headers = new Headers(init?.headers);
  if (init && 'json' in init) headers.set('content-type', 'application/json');
  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
    body: init && 'json' in init ? JSON.stringify(init.json) : init?.body,
  });
}

async function payload(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function responseOf(value: Response | undefined): Response {
  expect(value).toBeDefined();
  if (!value) throw new Error('Route handler returned no response');
  return value;
}

function expectOwnerScope(calls: Call[], ownerId: string) {
  expect(calls).toContainEqual({ table: 'pets', method: 'eq', args: ['owner_id', ownerId] });
}

beforeEach(() => {
  state.auth = { user: null, supabase: null, token: null };
  state.session = null;
  state.admin = null;
});

describe('care route characterization', () => {
  test.each([
    ['bearer', 'bearer-owner', null],
    ['app-session', null, 'session-owner'],
    ['matching principals', 'same-owner', 'same-owner'],
    ['conflicting principals keep bearer legacy priority', 'bearer-owner', 'session-owner'],
  ])('%s owner-scopes GET', async (_label, bearerOwner, sessionOwner) => {
    const db = fakeSupabase({ reminders: { data: [], error: null } });
    state.auth = { user: bearerOwner ? { id: bearerOwner } : null, supabase: bearerOwner ? db.client : null, token: bearerOwner ? 'token' : null };
    state.session = sessionOwner ? { ownerId: sessionOwner } : null;
    state.admin = db.client;
    const response = await getReminders(request('/api/reminders'));
    expect(response.status).toBe(200);
    expect(db.calls).toContainEqual({ table: 'reminders', method: 'eq', args: ['pets.owner_id', bearerOwner ?? sessionOwner] });
  });

  test('no auth returns legacy 401 when storage exists', async () => {
    state.admin = fakeSupabase({}).client;
    const response = await getReminders(request('/api/reminders'));
    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: 'AUTH_REQUIRED' });
  });

  test('missing storage returns demo response before auth rejection', async () => {
    const response = await getReminders(request('/api/reminders'));
    expect(response.status).toBe(200);
    expect(await payload(response)).toMatchObject({ reminders: [], mode: 'demo' });
  });

  test('storage error keeps legacy error envelope', async () => {
    const db = fakeSupabase({ reminders: { data: null, error: { message: 'db-down' } } });
    state.auth = { user: { id: 'owner-a' }, supabase: db.client, token: 'token' };
    const response = await getReminders(request('/api/reminders'));
    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: 'db-down' });
  });

  test('invalid mutation JSON keeps care envelope and never calls storage', async () => {
    const db = fakeSupabase({});
    state.admin = db.client;
    const response = await postReminder(request('/api/reminders', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    expect(await payload(response)).toMatchObject({ error: 'REMINDER_FIELDS_REQUIRED' });
    expect(db.calls).toHaveLength(0);
  });
});

describe('social route characterization', () => {
  test.each([
    ['bearer', 'bearer-owner', null],
    ['app-session', null, 'session-owner'],
    ['matching principals', 'same-owner', 'same-owner'],
  ])('%s owner-scopes GET', async (_label, bearerOwner, sessionOwner) => {
    const db = fakeSupabase({ pets: { data: { id: 'pet-a' }, error: null }, social_discovery_profiles: { data: null, error: null } });
    state.auth = { user: bearerOwner ? { id: bearerOwner } : null, supabase: bearerOwner ? db.client : null, token: bearerOwner ? 'token' : null };
    state.session = sessionOwner ? { ownerId: sessionOwner } : null;
    state.admin = db.client;
    const response = responseOf(await getSocialProfile(request('/api/social/profile?petId=pet-a')));
    expect(response.status).toBe(200);
    expectOwnerScope(db.calls, bearerOwner ?? sessionOwner ?? '');
  });

  test('principal conflict is the characterized legacy 401', async () => {
    const db = fakeSupabase({});
    state.auth = { user: { id: 'bearer-owner' }, supabase: db.client, token: 'token' };
    state.session = { ownerId: 'session-owner' };
    state.admin = db.client;
    const response = responseOf(await getSocialProfile(request('/api/social/profile?petId=pet-a')));
    expect(response.status).toBe(401);
    expect(await payload(response)).toEqual({ error: 'IDENTITY_PRINCIPAL_MISMATCH' });
    expect(db.calls).toHaveLength(0);
  });

  test.each([
    ['no auth', null, 401, 'AUTH_REQUIRED'],
    ['missing storage', { ownerId: 'owner-a' }, 503, 'SOCIAL_STORAGE_UNAVAILABLE'],
  ])('%s preserves status and envelope', async (_label, session, status, error) => {
    state.session = session;
    const response = responseOf(await getSocialProfile(request('/api/social/profile?petId=pet-a')));
    expect(response.status).toBe(status);
    expect(await payload(response)).toEqual({ error });
  });

  test('foreign pet is hidden as 404', async () => {
    const db = fakeSupabase({ pets: { data: null, error: null } });
    state.session = { ownerId: 'owner-a' };
    state.admin = db.client;
    const response = responseOf(await getSocialProfile(request('/api/social/profile?petId=foreign')));
    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: 'PET_NOT_FOUND' });
  });

  test('storage error keeps social envelope', async () => {
    const db = fakeSupabase({ pets: { data: { id: 'pet-a' }, error: null }, social_discovery_profiles: { data: null, error: { message: 'db-down' } } });
    state.session = { ownerId: 'owner-a' };
    state.admin = db.client;
    const response = responseOf(await getSocialProfile(request('/api/social/profile?petId=pet-a')));
    expect(response.status).toBe(500);
    expect(await payload(response)).toEqual({ error: 'SOCIAL_STORAGE_FAILED' });
  });

  test('invalid mutation JSON keeps social validation envelope', async () => {
    const db = fakeSupabase({});
    state.session = { ownerId: 'owner-a' };
    state.admin = db.client;
    const response = responseOf(await putSocialProfile(request('/api/social/profile', { method: 'PUT', body: '{' })));
    expect(response.status).toBe(400);
    expect(await payload(response)).toEqual({ error: 'PET_ID_REQUIRED' });
    expect(db.calls).toHaveLength(0);
  });
});

describe('v1 pet route characterization', () => {
  test.each([
    ['bearer', 'bearer-owner', null],
    ['app-session', null, 'session-owner'],
    ['matching principals', 'same-owner', 'same-owner'],
    ['conflicting principals keep bearer legacy priority', 'bearer-owner', 'session-owner'],
  ])('%s owner-scopes PATCH', async (_label, bearerOwner, sessionOwner) => {
    const db = fakeSupabase({ pets: { data: { id: 'pet-a' }, error: null }, profiles: { data: null, error: null } });
    state.auth = { user: bearerOwner ? { id: bearerOwner } : null, supabase: bearerOwner ? db.client : null, token: bearerOwner ? 'token' : null };
    state.session = sessionOwner ? { ownerId: sessionOwner } : null;
    state.admin = db.client;
    const response = await patchPet(request('/api/v1/pets', { method: 'PATCH', json: { activePetId: 'pet-a' } }));
    expect(response.status).toBe(200);
    expectOwnerScope(db.calls, bearerOwner ?? sessionOwner ?? '');
  });

  test('no auth returns ProblemJson 401', async () => {
    const response = await patchPet(request('/api/v1/pets', { method: 'PATCH', json: { activePetId: 'pet-a' } }));
    expect(response.status).toBe(401);
    expect(await payload(response)).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
  });

  test('missing storage returns ProblemJson 503', async () => {
    state.session = { ownerId: 'owner-a' };
    const response = await patchPet(request('/api/v1/pets', { method: 'PATCH', json: { activePetId: 'pet-a' } }));
    expect(response.status).toBe(503);
    expect(await payload(response)).toMatchObject({ code: 'STORAGE_REQUIRED', status: 503 });
  });

  test('foreign pet and storage errors preserve legacy ad hoc envelopes', async () => {
    const foreignDb = fakeSupabase({ pets: { data: null, error: null } });
    state.session = { ownerId: 'owner-a' };
    state.admin = foreignDb.client;
    const foreign = await patchPet(request('/api/v1/pets', { method: 'PATCH', json: { activePetId: 'foreign' } }));
    expect(foreign.status).toBe(404);
    expect(await payload(foreign)).toEqual({ error: 'PET_NOT_FOUND' });

    const errorDb = fakeSupabase({ pets: { data: null, error: { message: 'db-down' } } });
    state.admin = errorDb.client;
    const failed = await patchPet(request('/api/v1/pets', { method: 'PATCH', json: { activePetId: 'pet-a' } }));
    expect(failed.status).toBe(500);
    expect(await payload(failed)).toEqual({ error: 'db-down' });
  });

  test('invalid JSON returns ProblemJson validation error before auth/storage', async () => {
    const response = await patchPet(request('/api/v1/pets', { method: 'PATCH', body: '{' }));
    expect(response.status).toBe(400);
    expect(await payload(response)).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
  });
});

describe('map route characterization', () => {
  test.each([
    ['bearer', 'bearer-owner', null],
    ['app-session', null, 'session-owner'],
    ['matching principals', 'same-owner', 'same-owner'],
    ['conflicting principals keep bearer legacy priority', 'bearer-owner', 'session-owner'],
  ])('%s owner-scopes POST', async (_label, bearerOwner, sessionOwner) => {
    const db = fakeSupabase({ pets: { data: { id: 'pet-a' }, error: null }, map_zones: { data: { id: 'zone-a', share_token: null }, error: null } });
    state.auth = { user: bearerOwner ? { id: bearerOwner } : null, supabase: bearerOwner ? db.client : null, token: bearerOwner ? 'token' : null };
    state.session = sessionOwner ? { ownerId: sessionOwner } : null;
    state.admin = db.client;
    const response = await postMapFeature(request('/api/map/features', { method: 'POST', json: { type: 'point', title: 'Парк', petId: 'pet-a', lat: 55.75, lng: 37.62 } }));
    expect(response.status).toBe(201);
    expectOwnerScope(db.calls, bearerOwner ?? sessionOwner ?? '');
  });

  test.each([
    ['missing storage', null, null, 503, 'SUPABASE_NOT_CONFIGURED'],
    ['no auth', null, fakeSupabase({}).client, 401, 'AUTH_REQUIRED'],
  ])('%s preserves status and envelope', async (_label, session, admin, status, error) => {
    state.session = session;
    state.admin = admin;
    const response = await postMapFeature(request('/api/map/features', { method: 'POST', json: { type: 'point', title: 'Парк' } }));
    expect(response.status).toBe(status);
    expect(await payload(response)).toEqual({ error });
  });

  test('foreign pet is hidden as 404', async () => {
    const db = fakeSupabase({ pets: { data: null, error: null } });
    state.session = { ownerId: 'owner-a' };
    state.admin = db.client;
    const response = await postMapFeature(request('/api/map/features', { method: 'POST', json: { type: 'point', title: 'Парк', petId: 'foreign', lat: 55.75, lng: 37.62 } }));
    expect(response.status).toBe(404);
    expect(await payload(response)).toEqual({ error: 'PET_NOT_FOUND' });
  });

  test('storage error and invalid JSON preserve map envelopes', async () => {
    const failedDb = fakeSupabase({ pets: { data: { id: 'pet-a' }, error: null }, map_zones: { data: null, error: { message: 'db-down' } } });
    state.session = { ownerId: 'owner-a' };
    state.admin = failedDb.client;
    const failed = await postMapFeature(request('/api/map/features', { method: 'POST', json: { type: 'point', title: 'Парк', petId: 'pet-a', lat: 55.75, lng: 37.62 } }));
    expect(failed.status).toBe(500);
    expect(await payload(failed)).toEqual({ error: 'db-down' });

    const invalidDb = fakeSupabase({});
    state.admin = invalidDb.client;
    const invalid = await postMapFeature(request('/api/map/features', { method: 'POST', body: '{' }));
    expect(invalid.status).toBe(400);
    expect(await payload(invalid)).toEqual({ error: 'type and title are required' });
  });
});
