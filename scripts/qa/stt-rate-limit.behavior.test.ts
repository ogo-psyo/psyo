import assert from 'node:assert/strict';
import test from 'node:test';
import { claimSttCapacity, SttRateLimitError } from '../../lib/server/sttRateLimit';

test('claims owner-scoped STT capacity through the database', async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const supabase = { rpc: async (name: string, params: Record<string, unknown>) => {
    calls.push({ name, params });
    return { data: 17, error: null };
  } };
  assert.equal(await claimSttCapacity({ supabase, ownerId: '00000000-0000-4000-8000-000000000001' }), 17);
  assert.deepEqual(calls, [{ name: 'claim_stt_request', params: { p_owner_id: '00000000-0000-4000-8000-000000000001' } }]);
});

test('maps the database limit without exposing raw database errors', async () => {
  const supabase = { rpc: async () => ({ data: null, error: { message: 'STT_RATE_LIMITED internal detail' } }) };
  await assert.rejects(
    claimSttCapacity({ supabase, ownerId: '00000000-0000-4000-8000-000000000001' }),
    (error: Error) => error instanceof SttRateLimitError && error.code === 'STT_RATE_LIMITED' && error.message === 'STT_RATE_LIMITED',
  );
});
