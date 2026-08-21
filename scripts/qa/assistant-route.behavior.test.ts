import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantPostHandler } from '../../app/api/assistant/route';
import { createAppSessionToken } from '../../lib/server/appSession';

process.env.PSYO_SESSION_SIGNING_KEY = 'qa-assistant-session-key';

function query(data: unknown) {
  const value: any = {
    select: () => value,
    eq: () => value,
    neq: () => value,
    order: () => value,
    limit: () => value,
    maybeSingle: async () => ({ data, error: null }),
    single: async () => ({ data, error: null }),
    then: (resolve: (result: unknown) => void) => resolve({ data, error: null }),
  };
  return value;
}

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === 'pets') return query({ id: 'pet-1', owner_id: 'owner-1', name: 'Мята', life_stage: 'adult' });
      if (table === 'pet_passports') return query({ vaccine_status: 'up_to_date' });
      if (table === 'social_profiles') return query({ energy_level: 'medium', triggers: ['шум'] });
      if (table === 'reminders') return query([{ id: 'reminder-1', title: 'Обработка', status: 'active' }]);
      if (table === 'assistant_threads') return { insert: () => query({ id: 'thread-1' }) };
      if (table === 'assistant_messages') return { insert: async () => ({ data: [], error: null }) };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test('accepts a signed Telegram Mini App owner and returns guarded Groq metadata', async () => {
  const calls: any[] = [];
  const POST = createAssistantPostHandler({
    admin: () => fakeSupabase() as never,
    generate: async (input: any) => {
      calls.push(input);
      return {
        answer: 'План спокойной прогулки.',
        provider: 'groq',
        mode: 'groq_contextual',
        safetyLevel: 'non_medical_guidance',
        confidence: 'contextual_guidance',
        sourceBasis: 'owner_profile_and_active_care_context',
        usage: { inputTokens: 20, outputTokens: 8 },
      } as const;
    },
  });
  const session = createAppSessionToken({ psyoUserId: 'telegram-user', ownerId: 'owner-1' });
  const request = new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      cookie: `psyo_session=${encodeURIComponent(session.token)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ petId: 'pet-1', question: 'Сделай план спокойной прогулки.' }),
  });
  const response = await POST(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls[0].ownerId, 'owner-1');
  assert.equal(calls[0].kind, 'general');
  assert.equal(body.provider, 'groq');
  assert.equal(body.safetyLevel, 'non_medical_guidance');
  assert.equal(body.confidence, 'contextual_guidance');
  assert.equal(body.sourceBasis, 'owner_profile_and_active_care_context');
  assert.equal(body.threadId, 'thread-1');
});

test('does not accept client-supplied pet context without an authenticated owner', async () => {
  let generated = false;
  const POST = createAssistantPostHandler({
    admin: () => fakeSupabase() as never,
    generate: async () => { generated = true; throw new Error('must not run'); },
  });
  const response = await POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ petId: 'pet-1', question: 'Что делать?', context: { pet: { name: 'Чужая собака' } } }),
  }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'AUTH_REQUIRED');
  assert.equal(generated, false);
});
