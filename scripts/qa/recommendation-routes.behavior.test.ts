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

vi.mock('@/lib/server/recommendations/repository', () => ({
  createRecommendationService: vi.fn(() => ({
    listForPet: state.list,
    recalculateForPet: state.recalculate,
    store: { kind: 'test-store' },
  })),
}));

vi.mock('@/lib/server/recommendations/lifecycle', () => ({
  createSupabaseRecommendationDomainAdapter: vi.fn(() => ({ kind: 'test-domain' })),
  transitionForOwner: state.transition,
  recordOutcomeForOwner: state.outcome,
}));

import { GET, POST } from '@/app/api/recommendations/route';
import { PATCH } from '@/app/api/recommendations/[id]/route';
import { POST as POST_OUTCOME } from '@/app/api/recommendations/[id]/outcome/route';

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

beforeEach(() => {
  process.env.RECOMMENDATIONS_FOUNDATION_ENABLED = 'true';
  state.authUserId = 'owner-auth';
  state.sessionOwnerId = null;
  state.admin = {} as SupabaseClient;
  state.list.mockReset().mockResolvedValue([recommendation]);
  state.recalculate.mockReset().mockResolvedValue({ main: recommendation, secondary: [], evaluatedAt: '2026-09-02T12:00:00.000Z' });
  state.transition.mockReset().mockResolvedValue({ recommendation });
  state.outcome.mockReset().mockResolvedValue({ ...recommendation, status: 'completed' });
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
    expect(state.list).toHaveBeenCalledWith({ ownerId: 'owner-auth', petId: 'pet-1' });
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
});
