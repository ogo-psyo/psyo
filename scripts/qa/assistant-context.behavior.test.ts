import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantPostHandler } from '../../app/api/assistant/route';
import { createAppSessionToken } from '../../lib/server/appSession';

process.env.PSYO_SESSION_SIGNING_KEY = 'qa-assistant-context-key';

function query(data: unknown) {
  const value: any = {
    select: () => value, eq: () => value, neq: () => value, is: () => value,
    order: () => value, limit: () => value,
    maybeSingle: async () => ({ data, error: null }),
    single: async () => ({ data, error: null }),
    then: (resolve: (result: unknown) => void) => resolve({ data, error: null }),
  };
  return value;
}

function fixtureSupabase() {
  const tables: string[] = [];
  let threadInserts = 0;
  const messageInserts: unknown[] = [];
  const data: Record<string, unknown> = {
    pets: { id: 'pet-1', owner_id: 'owner-1', name: 'Мята', life_stage: 'adult' },
    pet_passports: { vaccine_status: 'unknown', parasite_status: 'unknown' },
    social_profiles: { energy_level: 'medium', social_mode: 'ask_first', triggers: ['шум'] },
    reminders: [{ id: 'reminder-1', title: 'Обработка', status: 'active' }],
    pet_observations: [{ type: 'energy', value: 'бодрая', observed_at: '2026-08-21T09:00:00Z' }],
    pet_documents: [{ title: 'Общий анализ крови', kind: 'analysis', document_date: '2026-08-20' }],
    map_routes: [{ title: 'Вечерний маршрут', activity_type: 'walk', distance_meters: 1800, started_at: '2026-08-20T18:00:00Z' }],
    assistant_threads: { id: 'thread-existing', pet_id: 'pet-1', kind: 'training' },
    assistant_messages: [
      { role: 'user', content: 'Мята тянет вечером' },
      { role: 'assistant', content: 'Начнём с дистанции до триггера' },
    ],
  };
  const supabase = {
    from(table: string) {
      tables.push(table);
      if (table === 'assistant_threads') {
        return { ...query(data[table]), insert: () => { threadInserts += 1; return query({ id: 'thread-new' }); } };
      }
      if (table === 'assistant_messages') {
        return { ...query(data[table]), insert: async (payload: unknown) => { messageInserts.push(payload); return { data: [], error: null }; } };
      }
      return query(data[table]);
    },
  };
  return { supabase, tables, get threadInserts() { return threadInserts; }, messageInserts };
}

function ownerRequest(body: Record<string, unknown>) {
  const session = createAppSessionToken({ psyoUserId: 'telegram-user', ownerId: 'owner-1' });
  return new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { origin: 'http://localhost', cookie: `psyo_session=${encodeURIComponent(session.token)}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('builds context from observations, documents, walks and recent thread history', async () => {
  const fixture = fixtureSupabase();
  let generatedInput: any;
  const POST = createAssistantPostHandler({
    admin: () => fixture.supabase as never,
    generate: async (input: any) => {
      generatedInput = input;
      return { answer: 'Контекстный ответ.', provider: 'groq', mode: 'groq_contextual', safetyLevel: 'non_medical_guidance', confidence: 'contextual_guidance', sourceBasis: 'owner_profile_and_active_care_context', usage: { inputTokens: 1, outputTokens: 1 } } as const;
    },
  });
  const response = await POST(ownerRequest({ petId: 'pet-1', threadId: 'thread-existing', question: 'А сегодня что изменить?' }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.threadId, 'thread-existing');
  assert.equal(fixture.threadInserts, 0);
  assert.ok(['pet_observations', 'pet_documents', 'map_routes'].every((table) => fixture.tables.includes(table)));
  assert.match(generatedInput.prompt, /бодрая/);
  assert.match(generatedInput.prompt, /Общий анализ крови/);
  assert.match(generatedInput.prompt, /Вечерний маршрут/);
  assert.match(generatedInput.prompt, /Мята тянет вечером/);
});

test('rules fallback translates database enums and never leaks internal product jargon', async () => {
  const fixture = fixtureSupabase();
  const POST = createAssistantPostHandler({
    admin: () => fixture.supabase as never,
    generate: async (input: any) => ({ answer: input.rulesAnswer, provider: 'rules', mode: 'rules_fallback_test', reason: 'TEST', safetyLevel: 'bounded_rules', confidence: 'rules_based', sourceBasis: 'owner_context' }) as never,
  });
  const response = await POST(ownerRequest({ petId: 'pet-1', question: 'Что делать сегодня?' }));
  const body = await response.json();

  assert.doesNotMatch(body.answer, /unknown|ask_first|care-loop|triage/i);
  assert.match(body.answer, /не указано/);
  assert.match(body.answer, /сначала спросить/);
});
