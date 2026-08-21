import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractObservationCandidates,
  ingestionFingerprint,
  planObservationIngestion,
  type ExistingStructuredObservation,
  type ObservationCandidate,
} from '../../lib/observationIngestion';

const existing: ExistingStructuredObservation[] = [
  {
    id: 'energy-morning',
    petId: 'pet-mint',
    metric: 'energy',
    value: 'менее активна',
    direction: 'down',
    observedAt: '2026-08-21T06:20:00.000Z',
    authorId: 'ruslan',
  },
  {
    id: 'appetite-morning',
    petId: 'pet-mint',
    metric: 'appetite',
    value: 'как обычно',
    direction: 'stable',
    observedAt: '2026-08-21T06:25:00.000Z',
    authorId: 'ruslan',
  },
];

function candidate(overrides: Partial<ObservationCandidate>): ObservationCandidate {
  return {
    id: 'candidate-energy',
    captureId: 'capture-1',
    petId: 'pet-mint',
    metric: 'energy',
    value: 'спит больше обычного',
    direction: 'down',
    observedAt: '2026-08-21T09:30:00.000Z',
    onsetAt: '2026-08-20T18:00:00.000Z',
    authorId: 'ruslan',
    source: 'voice',
    confidence: 0.94,
    transcriptSpan: 'больше спит со вчера',
    confirmed: true,
    ...overrides,
  };
}

test('plans complementary same-direction facts as merge and exact facts as update', () => {
  const plan = planObservationIngestion({
    candidates: [
      candidate({}),
      candidate({
        id: 'candidate-appetite',
        metric: 'appetite',
        value: 'как обычно',
        direction: 'stable',
        transcriptSpan: 'ест как обычно',
      }),
    ],
    existing,
  });

  assert.deepEqual(plan.decisions.map((item) => item.operation), ['merge', 'update']);
  assert.equal(plan.decisions[0].targetObservationId, 'energy-morning');
  assert.equal(plan.decisions[1].targetObservationId, 'appetite-morning');
  assert.deepEqual(plan.summary, { candidates: 2, create: 0, update: 1, merge: 1, conflict: 0, noop: 0, notesCreated: 0 });
});

test('does not average a contradictory fact from another owner', () => {
  const plan = planObservationIngestion({
    candidates: [candidate({
      id: 'candidate-appetite-conflict',
      metric: 'appetite',
      value: 'ела меньше',
      direction: 'down',
      authorId: 'anna',
      transcriptSpan: 'ела меньше',
    })],
    existing,
  });

  assert.equal(plan.decisions[0].operation, 'conflict');
  assert.equal(plan.decisions[0].analyticsEligible, false);
  assert.equal(plan.decisions[0].targetObservationId, 'appetite-morning');
});

test('keeps unknown-onset facts out of comparisons without turning them into notes', () => {
  const plan = planObservationIngestion({
    candidates: [candidate({
      id: 'candidate-sleep',
      metric: 'sleep',
      value: 'спит больше обычного',
      direction: 'up',
      onsetAt: null,
    })],
    existing: [],
  });

  assert.equal(plan.decisions[0].operation, 'create');
  assert.equal(plan.decisions[0].analyticsEligible, false);
  assert.equal(plan.summary.notesCreated, 0);
});

test('unconfirmed and low-confidence candidates cannot mutate observations', () => {
  const plan = planObservationIngestion({
    candidates: [
      candidate({ id: 'candidate-unconfirmed', confirmed: false }),
      candidate({ id: 'candidate-low', metric: 'sleep', confidence: 0.61 }),
    ],
    existing,
  });

  assert.deepEqual(plan.decisions.map((item) => item.operation), ['noop', 'noop']);
  assert.deepEqual(plan.decisions.map((item) => item.reason), ['confirmation_required', 'confidence_too_low']);
});

test('fingerprint is stable across candidate order for idempotent retries', () => {
  const energy = candidate({});
  const appetite = candidate({ id: 'candidate-appetite', metric: 'appetite', value: 'как обычно', direction: 'stable' });
  assert.equal(
    ingestionFingerprint([energy, appetite]),
    ingestionFingerprint([appetite, energy]),
  );
});

test('extracts structured energy and appetite facts from one natural Russian phrase', () => {
  const candidates = extractObservationCandidates({
    transcript: 'Мята сегодня больше спит со вчера, но ест как обычно.',
    captureId: 'capture-voice-1',
    petId: 'pet-mint',
    authorId: 'ruslan',
    observedAt: '2026-08-21T09:30:00.000Z',
  });

  assert.deepEqual(candidates.map((item) => ({
    metric: item.metric,
    value: item.value,
    direction: item.direction,
    onsetAt: item.onsetAt,
    source: item.source,
    transcriptSpan: item.transcriptSpan,
  })), [
    {
      metric: 'energy',
      value: 'спит больше обычного',
      direction: 'down',
      onsetAt: '2026-08-20T09:30:00.000Z',
      source: 'voice',
      transcriptSpan: 'больше спит со вчера',
    },
    {
      metric: 'appetite',
      value: 'как обычно',
      direction: 'stable',
      onsetAt: '2026-08-21T09:30:00.000Z',
      source: 'voice',
      transcriptSpan: 'ест как обычно',
    },
  ]);
});

test('returns no candidates instead of turning unstructured speech into a note', () => {
  const candidates = extractObservationCandidates({
    transcript: 'Мы славно погуляли около большого дерева.',
    captureId: 'capture-voice-2',
    petId: 'pet-mint',
    authorId: 'ruslan',
    observedAt: '2026-08-21T09:30:00.000Z',
  });
  assert.deepEqual(candidates, []);
});
