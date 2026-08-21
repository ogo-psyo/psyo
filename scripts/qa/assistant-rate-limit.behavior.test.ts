import assert from 'node:assert/strict';
import test from 'node:test';
import { AssistantRateLimitError, claimAssistantCapacity } from '../../lib/server/assistantRateLimit';

test('claims owner-scoped assistant capacity through Supabase', async () => {
  const calls: unknown[] = [];
  const supabase = { rpc: async (...args: unknown[]) => { calls.push(args); return { data: 19, error: null }; } };
  assert.equal(await claimAssistantCapacity({ supabase, ownerId: 'owner-1' }), 19);
  assert.deepEqual(calls, [['claim_assistant_request', { p_owner_id: 'owner-1' }]]);
});

test('maps the database limit to a stable application error', async () => {
  const supabase = { rpc: async () => ({ data: null, error: { message: 'ASSISTANT_RATE_LIMITED internal detail' } }) };
  await assert.rejects(
    claimAssistantCapacity({ supabase, ownerId: 'owner-1' }),
    (error: Error) => error instanceof AssistantRateLimitError && error.code === 'ASSISTANT_RATE_LIMITED' && error.message === 'ASSISTANT_RATE_LIMITED',
  );
});
