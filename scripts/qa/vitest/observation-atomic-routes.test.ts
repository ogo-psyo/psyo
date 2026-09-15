import { beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({
  owner: 'owner-a' as string | null,
  rpc: vi.fn(),
  from: vi.fn(() => { throw new Error('HTTP must not mutate tables outside the transaction'); }),
}));
vi.mock('@/lib/server/auth', () => ({ getRequestAuth: async () => ({ user: state.owner ? { id: state.owner } : null }) }));
vi.mock('@/lib/server/appSession', () => ({ getAppSessionFromRequest: () => null }));
vi.mock('@/lib/server/supabase', () => ({ getSupabaseAdmin: () => ({ rpc: state.rpc, from: state.from }), demoModeResponse: () => ({ mode: 'demo' }) }));
import { POST as create } from '@/app/api/observations/route';
import { PATCH as update, DELETE as remove } from '@/app/api/observations/[id]/route';
import { POST as restore } from '@/app/api/observations/[id]/restore/route';
const ctx = { params: Promise.resolve({ id: 'observation-a' }) };
const row = { id: 'observation-a', pet_id: 'pet-a', type: 'note', value: 'Text', metadata: { energy: 'normal', sourceNote: null }, observed_at: '2026-09-09T00:00:00Z' };
function request(method: string, body: object, key = 'test-request-key') {
  return new Request('https://pso.test/api/observations', { method, headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); state.owner = 'owner-a'; state.rpc.mockResolvedValue({ data: { observation: row, mode: 'supabase' }, error: null }); });
test('creation retry without date uses the same fingerprint, server owner and DTO', async () => {
  const body = { petId: 'pet-a', type: 'note', value: 'Text', ownerId: 'forged-owner' };
  const a = await create(request('POST', body));
  await new Promise(resolve => setTimeout(resolve, 5));
  const b = await create(request('POST', body));
  expect(a.status).toBe(201); expect(await a.json()).toEqual(await b.json());
  const first = state.rpc.mock.calls[0][1];
  expect(first).toMatchObject({ p_owner_id: 'owner-a', p_action: 'create', p_patch: { observed_at: null } });
  expect(first.p_request_fingerprint).toBe(state.rpc.mock.calls[1][1].p_request_fingerprint);
  expect(state.from).not.toHaveBeenCalled();
});
test('transport failure never deletes the receipt; retry still submits the same command', async () => {
  state.rpc.mockRejectedValueOnce(new Error('connection lost after commit'));
  const body = { petId: 'pet-a', mood: 'happy' };
  expect((await create(request('POST', body))).status).toBe(500);
  expect((await create(request('POST', body))).status).toBe(201);
  expect(state.rpc.mock.calls[0]).toEqual(state.rpc.mock.calls[1]);
  expect(state.from).not.toHaveBeenCalled();
});
test('patch fingerprints only the user patch, and lets the DB merge metadata', async () => {
  const response = await update(request('PATCH', { metadata: { mood: 'happy' } }), ctx);
  expect(response.status).toBe(200);
  expect(state.rpc.mock.calls[0][1].p_patch).toEqual({ metadata: { mood: 'happy' } });
  expect(state.from).not.toHaveBeenCalled();
});
test.each([['delete', remove, 'DELETE'], ['restore', restore, 'POST']] as const)('%s uses receipt replay before any HTTP active-row lookup', async (action, handler, method) => {
  state.rpc.mockResolvedValue({ data: { ok: true, restored: action === 'restore' }, error: null });
  expect((await handler(request(method, {}), ctx)).status).toBe(200);
  expect(state.rpc.mock.calls[0][1].p_action).toBe(action);
  expect(state.from).not.toHaveBeenCalled();
});
test.each([['OBSERVATION_NOT_FOUND',404], ['IDEMPOTENCY_KEY_REUSED',409], ['CARE_MUTATION_IN_PROGRESS',409]])('maps %s to %s without receipt cleanup', async (message, status) => {
  state.rpc.mockResolvedValue({ data: null, error: { message } });
  const response = await remove(request('DELETE', {}), ctx);
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: message });
  expect(state.from).not.toHaveBeenCalled();
});
test('unauthenticated mutation never reaches privileged RPC', async () => {
  state.owner = null;
  expect((await create(request('POST', { petId: 'pet-a', mood: 'happy' }))).status).toBe(401);
  expect(state.rpc).not.toHaveBeenCalled();
});
