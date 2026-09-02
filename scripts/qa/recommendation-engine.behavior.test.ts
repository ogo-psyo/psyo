import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRecommendationContext } from '../../lib/server/recommendations/contextSnapshot';

type Fixture = { data: unknown; error: unknown };

class QueryStub implements PromiseLike<Fixture> {
  constructor(
    private readonly fixture: Fixture,
    private readonly calls: string[],
    private readonly table: string,
  ) {}

  select(columns: string) { this.calls.push(`${this.table}.select:${columns}`); return this; }
  eq(column: string, value: unknown) { this.calls.push(`${this.table}.eq:${column}=${String(value)}`); return this; }
  neq(column: string, value: unknown) { this.calls.push(`${this.table}.neq:${column}=${String(value)}`); return this; }
  is(column: string, value: unknown) { this.calls.push(`${this.table}.is:${column}=${String(value)}`); return this; }
  order(column: string, options: unknown) { this.calls.push(`${this.table}.order:${column}:${JSON.stringify(options)}`); return this; }
  limit(value: number) { this.calls.push(`${this.table}.limit:${value}`); return this; }
  maybeSingle() { return Promise.resolve(this.fixture); }
  then<TResult1 = Fixture, TResult2 = never>(
    onfulfilled?: ((value: Fixture) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.fixture).then(onfulfilled, onrejected);
  }
}

function supabaseStub(fixtures: Record<string, Fixture>) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return new QueryStub(fixtures[table] ?? { data: [], error: null }, calls, table);
      },
    },
  };
}

test('context snapshot is owner scoped, bounded, provenance rich and privacy allowlisted', async () => {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const { client, calls } = supabaseStub({
    pets: { data: {
      id: 'pet-1', owner_id: 'owner-1', life_stage: 'adult', weight_kg: 18,
      breed_id: 'labrador', breed_group_id: 'retriever',
      avatar_url: 'SECRET_PHOTO', photo_urls: ['SECRET_PHOTO_2'],
    }, error: null },
    pet_passports: { data: {
      pet_id: 'pet-1', diet: 'dry', allergies: 'chicken', medication: null,
      health_notes: 'sensitive stomach', vaccine_status: 'actual', parasite_status: 'actual',
      updated_at: '2026-09-01T10:00:00.000Z', microchip: 'SECRET_MICROCHIP', vet_contact: 'SECRET_CONTACT',
    }, error: null },
    social_profiles: { data: {
      pet_id: 'pet-1', social_mode: 'ask_first', temperament: 'calm', energy_level: 'medium',
      play_style: 'gentle', trainability: 'high', child_friendly: 'yes', dog_friendly: 'careful',
      cat_friendly: 'unknown', triggers: ['scooters'], updated_at: '2026-09-01T11:00:00.000Z',
    }, error: null },
    reminders: { data: [{
      id: 'reminder-1', type: 'grooming', title: 'Когти', due_at: '2026-09-01T09:00:00.000Z',
      snoozed_until: null, status: 'active', updated_at: '2026-08-30T09:00:00.000Z',
      metadata: { documentContent: 'SECRET_DOCUMENT_CONTENT' },
    }], error: null },
    pet_observations: { data: [
      {
        id: 'observation-voice-ok', type: 'appetite', value: 'ест меньше', note: 'SECRET_RAW_NOTE',
        observed_at: '2026-09-02T08:00:00.000Z', source: 'assistant', updated_at: '2026-09-02T08:01:00.000Z',
        metadata: {
          voiceCapture: { inputSource: 'voice' },
          candidate: { confirmed: true, confidence: 0.91, transcriptSpan: 'ест меньше' },
        },
      },
      {
        id: 'observation-voice-low', type: 'energy', value: 'вялая', note: 'SECRET_UNCONFIRMED_NOTE',
        observed_at: '2026-09-02T07:00:00.000Z', source: 'assistant', updated_at: '2026-09-02T07:01:00.000Z',
        metadata: { inputSource: 'voice', ownerConfirmed: false, inputConfidence: 0.99, excerpt: 'вялая' },
      },
      {
        id: 'observation-manual', type: 'mood', value: 'спокойная', note: 'SECRET_MANUAL_NOTE',
        observed_at: '2026-09-01T18:00:00.000Z', source: 'manual', updated_at: '2026-09-01T18:01:00.000Z', metadata: {},
      },
    ], error: null },
    pet_habits: { data: [{
      id: 'habit-1', kind: 'training', title: 'Выдержка', cadence: 'daily', target_per_period: 1,
      status: 'active', created_at: '2026-08-20T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }], error: null },
    map_zones: { data: [{
      id: 'zone-1', type: 'risk_zone', title: 'Самокаты', area_label: 'у парка', note: 'много самокатов',
      approximate_lat: 55.751, approximate_lng: 37.618, radius_meters: 80,
      created_at: '2026-08-25T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }], error: null },
    wishlist_items: { data: [{
      id: 'thing-1', title: 'Шлейка', category: 'gear', reason: 'для прогулки', priority: 'medium',
      status: 'not_suitable', created_at: '2026-08-22T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
      url: 'SECRET_SHOPPING_URL',
    }], error: null },
  });

  const snapshot = await loadRecommendationContext({
    supabase: client as never, ownerId: 'owner-1', petId: 'pet-1', now,
  });
  const serialized = JSON.stringify(snapshot);

  for (const secret of [
    'SECRET_PHOTO', 'SECRET_PHOTO_2', 'SECRET_MICROCHIP', 'SECRET_CONTACT',
    'SECRET_DOCUMENT_CONTENT', 'SECRET_RAW_NOTE', 'SECRET_UNCONFIRMED_NOTE',
    'SECRET_MANUAL_NOTE', 'SECRET_SHOPPING_URL', '55.751', '37.618',
  ]) assert.equal(serialized.includes(secret), false, `snapshot leaked ${secret}`);

  assert.equal(snapshot.pet.id, 'pet-1');
  assert.equal(snapshot.reminders.length, 1);
  assert.equal(snapshot.observations.length, 3);
  assert.equal(snapshot.observations[0]?.sufficient, true);
  assert.equal(snapshot.observations[0]?.evidence.ownerConfirmed, true);
  assert.equal(snapshot.observations[0]?.evidence.inputConfidence, 0.91);
  assert.equal(snapshot.observations[0]?.evidence.excerpt, 'ест меньше');
  assert.equal(snapshot.observations[1]?.sufficient, false);
  assert.equal(snapshot.observations[1]?.value, undefined);
  assert.equal(snapshot.observations[2]?.value, 'спокойная');
  assert.deepEqual(snapshot.zones[0], {
    id: 'zone-1', type: 'risk_zone', title: 'Самокаты', areaLabel: 'у парка', note: 'много самокатов',
    evidence: snapshot.zones[0]?.evidence,
  });
  assert.equal(snapshot.facts.every((fact) => fact.capturedAt === now.toISOString()), true);
  assert.equal(calls.includes('pet_observations.limit:20'), true);
  assert.equal(calls.includes('pet_habits.eq:status=active'), true);
  assert.equal(calls.includes('wishlist_items.is:deleted_at=null'), true);
});

test('context snapshot stops after the owner check for an unowned pet', async () => {
  const { client, calls } = supabaseStub({ pets: { data: null, error: null } });

  await assert.rejects(
    loadRecommendationContext({
      supabase: client as never,
      ownerId: 'owner-1',
      petId: 'unowned-pet',
      now: new Date('2026-09-02T12:00:00.000Z'),
    }),
    /PET_NOT_FOUND/,
  );

  assert.deepEqual(calls.filter((call) => call.startsWith('from:')), ['from:pets']);
});
