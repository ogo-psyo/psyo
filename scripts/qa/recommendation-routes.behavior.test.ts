import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authUserId: null as string | null,
  sessionOwnerId: null as string | null,
  admin: null as SupabaseClient | null,
  list: vi.fn(),
  recalculate: vi.fn(),
  transition: vi.fn(),
  outcome: vi.fn(),
  link: vi.fn(),
  habitCheckin: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  getRequestAuth: vi.fn(async () => ({
    user: state.authUserId ? { id: state.authUserId } : null,
    supabase: null,
    token: null,
  })),
}));

vi.mock('@/lib/server/appSession', () => ({
  getAppSessionFromRequest: vi.fn(() => state.sessionOwnerId ? { ownerId: state.sessionOwnerId } : null),
}));

vi.mock('@/lib/server/supabase', () => ({ getSupabaseAdmin: vi.fn(() => state.admin) }));

vi.mock('@/lib/server/recommendations/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/recommendations/repository')>();
  return {
    ...actual,
    createRecommendationService: vi.fn(() => ({
      listForPet: state.list,
      recalculateForPet: state.recalculate,
      store: { kind: 'test-store' },
    })),
  };
});

vi.mock('@/lib/server/recommendations/lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/recommendations/lifecycle')>();
  return {
    ...actual,
    createSupabaseRecommendationDomainAdapter: vi.fn(() => ({ kind: 'test-domain' })),
    transitionForOwner: state.transition,
    recordOutcomeForOwner: state.outcome,
  };
});

vi.mock('@/lib/server/recommendations/domainOutcomeLink', () => ({
  linkRecommendationOutcome: state.link,
}));

vi.mock('@/lib/server/habitService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/habitService')>();
  return { ...actual, checkInHabitForOwner: state.habitCheckin };
});

import { GET, POST } from '@/app/api/recommendations/route';
import { PATCH } from '@/app/api/recommendations/[id]/route';
import { POST as POST_OUTCOME } from '@/app/api/recommendations/[id]/outcome/route';
import { POST as COMPLETE_REMINDER } from '@/app/api/reminders/[id]/complete/route';
import { POST as CHECK_IN_HABIT } from '@/app/api/habits/[id]/checkins/route';
import { POST as CREATE_WISHLIST } from '@/app/api/wishlist/route';
import { GET as GET_MAP, POST as CREATE_MAP_FEATURE } from '@/app/api/map/features/route';

const recommendation = {
  id: 'recommendation-1', petId: 'pet-1', subjectId: 'private-subject', scenarioKey: 'care_due', policyVersion: 'care_due@1',
  category: 'care', risk: 'routine', status: 'shown', fingerprint: 'a'.repeat(64), title: 'Проверить дело',
  whyNow: ['Срок наступил'], primaryAction: { intent: 'open_reminder', reminderId: 'reminder-1' },
  confidence: { dataSufficiency: 'high', sourceReliability: 'high', ruleCertainty: 'high' },
  rank: { tier: 2, urgency: 100, actionability: 100, relevance: 100, annoyancePenalty: 0 },
  suppressionReasons: [], missingData: [], conflicts: [], freshUntil: '2026-09-03T00:00:00.000Z',
  expiresAt: '2026-09-04T00:00:00.000Z', createdAt: '2026-09-02T00:00:00.000Z', ownerId: 'SECRET_OWNER',
  owner_id: 'SECRET_OWNER_SNAKE', raw_payload: 'SECRET_RAW', coordinates: [55.75, 37.61],
  evidence: [{
    sourceType: 'reminder', sourceId: 'reminder-1', capturedAt: '2026-09-02T00:00:00.000Z', ownerConfirmed: true,
    excerpt: 'Когти', payload: 'SECRET_EVIDENCE_PAYLOAD', coordinates: [55.75, 37.61],
  }],
};

function request(path: string, init?: RequestInit & { json?: unknown }) {
  const headers = new Headers(init?.headers);
  if (init && 'json' in init) headers.set('content-type', 'application/json');
  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
    body: init && 'json' in init ? JSON.stringify(init.json) : init?.body,
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

type DbResult = { data: unknown; error: { message: string } | null };

function fakeDatabase(results: Record<string, DbResult>) {
  const calls: Array<{ target: string; method: string; args: unknown[] }> = [];
  function query(table: string) {
    const result = results[table] ?? { data: null, error: null };
    const chain = {
      then(resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
    } as Record<string, unknown>;
    for (const method of ['eq', 'gte', 'insert', 'is', 'limit', 'maybeSingle', 'order', 'select', 'single', 'upsert'] as const) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ target: table, method, args });
        return chain;
      };
    }
    return chain;
  }
  const client = {
    from(table: string) {
      calls.push({ target: table, method: 'from', args: [] });
      return query(table);
    },
    rpc(name: string, args: unknown) {
      calls.push({ target: 'rpc', method: name, args: [args] });
      return Promise.resolve(results[`rpc:${name}`] ?? { data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

beforeEach(() => {
  process.env.RECOMMENDATIONS_FOUNDATION_ENABLED = 'true';
  state.authUserId = 'owner-auth';
  state.sessionOwnerId = null;
  state.admin = {} as SupabaseClient;
  state.list.mockReset().mockResolvedValue([recommendation]);
  state.recalculate.mockReset().mockResolvedValue({ main: recommendation, secondary: [], evaluatedAt: '2026-09-02T12:00:00.000Z' });
  state.transition.mockReset().mockResolvedValue({ recommendation });
  state.outcome.mockReset().mockResolvedValue({ ...recommendation, status: 'completed' });
  state.link.mockReset().mockResolvedValue('linked');
  state.habitCheckin.mockReset().mockResolvedValue({ id: 'checkin-1', completedAt: '2026-09-02T12:00:00.000Z', replayed: false });
});

describe('hidden recommendation collection route', () => {
  test('exact disabled-by-default flag returns RFC7807 404 before auth or storage', async () => {
    process.env.RECOMMENDATIONS_FOUNDATION_ENABLED = 'TRUE';
    state.authUserId = null;
    state.admin = null;
    const response = await GET(request('/api/recommendations?petId=pet-1'));
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await body(response)).toMatchObject({ code: 'RECOMMENDATIONS_DISABLED', status: 404 });
  });

  test('missing auth is 401 and storage unavailability is 503', async () => {
    state.authUserId = null;
    expect((await GET(request('/api/recommendations?petId=pet-1'))).status).toBe(401);
    state.authUserId = 'owner-auth';
    state.admin = null;
    expect((await GET(request('/api/recommendations?petId=pet-1'))).status).toBe(503);
  });

  test('GET lists without recalculation and strips owner, raw payload and coordinates', async () => {
    const response = await GET(request('/api/recommendations?petId=pet-1'));
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-auth', petId: 'pet-1', now: expect.any(Date) }));
    expect(state.recalculate).not.toHaveBeenCalled();
    const serialized = JSON.stringify(await body(response));
    for (const secret of ['SECRET_OWNER', 'SECRET_OWNER_SNAKE', 'SECRET_RAW', 'SECRET_EVIDENCE_PAYLOAD', '55.75', '37.61']) {
      expect(serialized).not.toContain(secret);
    }
  });

  test('foreign pet becomes 404 and malformed recalculation body becomes 400', async () => {
    state.list.mockRejectedValueOnce(new Error('PET_NOT_FOUND'));
    expect((await GET(request('/api/recommendations?petId=foreign'))).status).toBe(404);
    const malformed = await POST(request('/api/recommendations', { method: 'POST', body: '{' }));
    expect(malformed.status).toBe(400);
  });

  test('POST ignores body ownerId and uses the authenticated principal', async () => {
    const response = await POST(request('/api/recommendations', {
      method: 'POST', json: { petId: 'pet-1', ownerId: 'attacker', explicitRequest: { walk: { requestId: 'walk-1', mode: 'explicit' } } },
    }));
    expect(response.status).toBe(200);
    expect(state.recalculate).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-auth', petId: 'pet-1' }));
  });
});

describe('recommendation lifecycle routes', () => {
  const ctx = { params: Promise.resolve({ id: 'recommendation-1' }) };

  test('disabled flag also hides lifecycle and outcome endpoints', async () => {
    process.env.RECOMMENDATIONS_FOUNDATION_ENABLED = 'false';
    const patch = await PATCH(request('/api/recommendations/recommendation-1', { method: 'PATCH' }), ctx);
    const outcome = await POST_OUTCOME(request('/api/recommendations/recommendation-1/outcome', { method: 'POST' }), ctx);
    expect(patch.status).toBe(404);
    expect(outcome.status).toBe(404);
    expect(state.transition).not.toHaveBeenCalled();
    expect(state.outcome).not.toHaveBeenCalled();
  });

  test('PATCH requires idempotency and maps a reused key to 409', async () => {
    const missing = await PATCH(request('/api/recommendations/recommendation-1', {
      method: 'PATCH', json: { action: 'accept' },
    }), ctx);
    expect(missing.status).toBe(400);
    state.transition.mockRejectedValueOnce(new Error('IDEMPOTENCY_KEY_REUSED'));
    const reused = await PATCH(request('/api/recommendations/recommendation-1', {
      method: 'PATCH', headers: { 'Idempotency-Key': 'accept-key-1' }, json: { action: 'accept' },
    }), ctx);
    expect(reused.status).toBe(409);
  });

  test('PATCH rejects malformed lifecycle commands', async () => {
    const response = await PATCH(request('/api/recommendations/recommendation-1', {
      method: 'PATCH', headers: { 'Idempotency-Key': 'invalid-key-1' }, json: { action: 'dismiss' },
    }), ctx);
    expect(response.status).toBe(400);
  });

  test('PATCH exposes the impression transition needed before user controls', async () => {
    const response = await PATCH(request('/api/recommendations/recommendation-1', {
      method: 'PATCH', headers: { 'Idempotency-Key': 'show-key-0001' }, json: { action: 'show' },
    }), ctx);
    expect(response.status).toBe(200);
    expect(state.transition).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-auth', recommendationId: 'recommendation-1', command: { action: 'show' },
    }));
  });

  test('outcome validates its shape and forwards the URL recommendation id', async () => {
    const invalid = await POST_OUTCOME(request('/api/recommendations/recommendation-1/outcome', {
      method: 'POST', headers: { 'Idempotency-Key': 'outcome-key-1' }, json: { result: 'completed' },
    }), ctx);
    expect(invalid.status).toBe(400);
    const valid = await POST_OUTCOME(request('/api/recommendations/recommendation-1/outcome', {
      method: 'POST', headers: { 'Idempotency-Key': 'outcome-key-2' },
      json: { recommendationId: 'attacker-id', domainType: 'reminder', domainId: 'reminder-1', result: 'completed', occurredAt: '2026-09-02T12:00:00.000Z' },
    }), ctx);
    expect(valid.status).toBe(200);
    expect(state.outcome).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-auth', outcome: expect.objectContaining({ recommendationId: 'recommendation-1' }),
    }));
  });

  test('foreign lifecycle and outcome targets are both hidden as 404', async () => {
    state.transition.mockRejectedValueOnce(new Error('RECOMMENDATION_NOT_FOUND'));
    const lifecycle = await PATCH(request('/api/recommendations/foreign', {
      method: 'PATCH', headers: { 'Idempotency-Key': 'foreign-patch-1' }, json: { action: 'accept' },
    }), { params: Promise.resolve({ id: 'foreign' }) });
    state.outcome.mockRejectedValueOnce(new Error('RECOMMENDATION_NOT_FOUND'));
    const outcome = await POST_OUTCOME(request('/api/recommendations/foreign/outcome', {
      method: 'POST', headers: { 'Idempotency-Key': 'foreign-outcome-1' },
      json: { domainType: 'reminder', domainId: 'reminder-1', result: 'completed', occurredAt: '2026-09-02T12:00:00.000Z' },
    }), { params: Promise.resolve({ id: 'foreign' }) });
    expect(lifecycle.status).toBe(404);
    expect(outcome.status).toBe(404);
  });
});

describe('domain outcome post-success linking', () => {
  test('reminder success links after its domain RPC and link failure stays a successful pending response', async () => {
    const db = fakeDatabase({ 'rpc:care_complete_reminder_atomic': { data: { id: 'reminder-1', replayed: false }, error: null } });
    state.admin = db.client;
    state.link.mockResolvedValueOnce('pending');
    const response = await COMPLETE_REMINDER(request('/api/reminders/reminder-1/complete', {
      method: 'POST', headers: { 'Idempotency-Key': 'reminder-key-1' },
      json: { recommendationId: 'recommendation-1', completedAt: '2026-09-02T12:00:00.000Z' },
    }), { params: Promise.resolve({ id: 'reminder-1' }) });
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ id: 'reminder-1', recommendationOutcome: 'pending' });
    expect(state.link).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-auth', recommendationId: 'recommendation-1', domainType: 'reminder', domainId: 'reminder-1',
    }));
  });

  test('failed reminder mutation emits no recommendation outcome', async () => {
    const db = fakeDatabase({ 'rpc:care_complete_reminder_atomic': { data: null, error: { message: 'domain-failed' } } });
    state.admin = db.client;
    const response = await COMPLETE_REMINDER(request('/api/reminders/reminder-1/complete', {
      method: 'POST', headers: { 'Idempotency-Key': 'reminder-key-2' }, json: { recommendationId: 'recommendation-1' },
    }), { params: Promise.resolve({ id: 'reminder-1' }) });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(state.link).not.toHaveBeenCalled();
  });

  test('habit and wishlist successes link their persisted domain ids', async () => {
    state.admin = fakeDatabase({
      pets: { data: { id: 'pet-1' }, error: null },
      wishlist_items: { data: { id: 'wishlist-1', pet_id: 'pet-1', title: 'Шлейка' }, error: null },
    }).client;
    const habit = await CHECK_IN_HABIT(request('/api/habits/habit-1/checkins', {
      method: 'POST', headers: { 'Idempotency-Key': 'habit-key-1' }, json: { recommendationId: 'recommendation-1' },
    }), { params: Promise.resolve({ id: 'habit-1' }) });
    const wishlist = await CREATE_WISHLIST(request('/api/wishlist', {
      method: 'POST', headers: { 'Idempotency-Key': 'wishlist-key-1' },
      json: { petId: 'pet-1', title: 'Шлейка', category: 'gear', recommendationId: 'recommendation-2' },
    }));
    expect(habit.status).toBe(201);
    expect(wishlist.status).toBe(201);
    expect(state.link).toHaveBeenCalledWith(expect.objectContaining({ domainType: 'habit', domainId: 'habit-1' }));
    expect(state.link).toHaveBeenCalledWith(expect.objectContaining({ domainType: 'wishlist', domainId: 'wishlist-1' }));
  });

  test('opening the map is not completion, while saving a route is', async () => {
    const db = fakeDatabase({
      'rpc:get_map_features_in_bounds': { data: [], error: null },
      pets: { data: { id: 'pet-1' }, error: null },
      map_routes: { data: { id: 'route-1', share_token: null }, error: null },
    });
    state.admin = db.client;
    const opened = await GET_MAP(request('/api/map/features?bounds=55,37,56,38'));
    expect(opened.status).toBe(200);
    expect(state.link).not.toHaveBeenCalled();
    const saved = await CREATE_MAP_FEATURE(request('/api/map/features', {
      method: 'POST', headers: { 'Idempotency-Key': 'route-key-1' },
      json: {
        type: 'route', petId: 'pet-1', title: 'Маршрут', path: [[37.61, 55.75], [37.62, 55.76]],
        recommendationId: 'recommendation-1', routeSource: 'recorded', startedAt: '2026-09-02T11:00:00.000Z',
      },
    }));
    expect(saved.status).toBe(201);
    expect(state.link).toHaveBeenCalledWith(expect.objectContaining({ domainType: 'route', domainId: 'route-1' }));
  });

  test('domain replay reuses the same derived outcome key', async () => {
    const db = fakeDatabase({ 'rpc:care_complete_reminder_atomic': { data: { id: 'reminder-1', replayed: true }, error: null } });
    state.admin = db.client;
    const make = () => COMPLETE_REMINDER(request('/api/reminders/reminder-1/complete', {
      method: 'POST', headers: { 'Idempotency-Key': 'replay-key-1' }, json: { recommendationId: 'recommendation-1' },
    }), { params: Promise.resolve({ id: 'reminder-1' }) });
    await make();
    await make();
    const keys = state.link.mock.calls.map(([input]) => (input as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toEqual(['replay-key-1', 'replay-key-1']);
  });

  test('foreign recommendation is queued as a retryable failure and never reported linked', async () => {
    const actual = await vi.importActual<typeof import('@/lib/server/recommendations/domainOutcomeLink')>(
      '@/lib/server/recommendations/domainOutcomeLink',
    );
    const db = fakeDatabase({ recommendation_outcome_failures: { data: null, error: null } });
    const result = await actual.linkRecommendationOutcome({
      supabase: db.client,
      ownerId: 'owner-auth',
      recommendationId: 'foreign-recommendation',
      domainType: 'reminder',
      domainId: 'reminder-1',
      result: 'completed',
      idempotencyKey: 'foreign-key-1',
      occurredAt: '2026-09-02T12:00:00.000Z',
    }, {
      store: () => ({}) as never,
      domain: () => ({}) as never,
      record: async () => { throw new Error('RECOMMENDATION_NOT_FOUND'); },
    });
    expect(result).toBe('pending');
    expect(db.calls).toContainEqual(expect.objectContaining({ target: 'recommendation_outcome_failures', method: 'upsert' }));
    const upsert = db.calls.find((call) => call.target === 'recommendation_outcome_failures' && call.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({ owner_id: 'owner-auth', error_code: 'RECOMMENDATION_NOT_FOUND' });
  });
});
