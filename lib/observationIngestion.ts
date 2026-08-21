export type ObservationMetric = 'mood' | 'energy' | 'appetite' | 'stool' | 'sleep' | 'activity' | 'symptom' | 'behavior_change';
export type ObservationDirection = 'up' | 'down' | 'stable' | 'unknown';
export type IngestionOperation = 'create' | 'update' | 'merge' | 'conflict' | 'noop';

export type ObservationCandidate = {
  id: string;
  captureId: string;
  petId: string;
  metric: ObservationMetric;
  value: string;
  direction: ObservationDirection;
  observedAt: string;
  onsetAt?: string | null;
  authorId: string;
  source: 'voice' | 'text';
  confidence: number;
  transcriptSpan: string;
  confirmed: boolean;
};

export type ExistingStructuredObservation = {
  id: string;
  petId: string;
  metric: ObservationMetric;
  value: string;
  direction: ObservationDirection;
  observedAt: string;
  authorId: string;
};

export type IngestionDecision = {
  candidateId: string;
  operation: IngestionOperation;
  targetObservationId?: string;
  analyticsEligible: boolean;
  reason: string;
};

export type ObservationIngestionPlan = {
  petId: string;
  captureId: string;
  decisions: IngestionDecision[];
  summary: {
    candidates: number;
    create: number;
    update: number;
    merge: number;
    conflict: number;
    noop: number;
    notesCreated: 0;
  };
};

const MIN_AUTO_SAVE_CONFIDENCE = 0.8;

type CandidateExtractionInput = {
  transcript: string;
  captureId: string;
  petId: string;
  authorId: string;
  observedAt: string;
};

function parseIso(value: string, field: string) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`INVALID_${field.toUpperCase()}`);
  return parsed;
}

function normalizedValue(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}

function onsetFromTranscript(transcript: string, observedAt: string) {
  const observed = parseIso(observedAt, 'observed_at');
  if (/со вчера|со вчерашн/i.test(transcript)) return new Date(observed.getTime() - 24 * 60 * 60 * 1000).toISOString();
  if (/сегодня|с утра|утром/i.test(transcript)) return observed.toISOString();
  return null;
}

export function extractObservationCandidates(input: CandidateExtractionInput): ObservationCandidate[] {
  const transcript = input.transcript.trim();
  if (!transcript) return [];
  parseIso(input.observedAt, 'observed_at');
  const candidates: ObservationCandidate[] = [];
  const onsetAt = onsetFromTranscript(transcript, input.observedAt);

  const lowerEnergy = transcript.match(/(больше\s+спит(?:\s+со\s+вчера)?|менее\s+актив\w*|быстрее\s+уста[её]т|вял\w*)/i);
  if (lowerEnergy) {
    candidates.push({
      id: `${input.captureId}:energy`,
      captureId: input.captureId,
      petId: input.petId,
      metric: 'energy',
      value: /больше\s+спит/i.test(lowerEnergy[0]) ? 'спит больше обычного' : 'менее активна',
      direction: 'down',
      observedAt: input.observedAt,
      onsetAt,
      authorId: input.authorId,
      source: 'voice',
      confidence: 0.92,
      transcriptSpan: lowerEnergy[0].toLocaleLowerCase('ru-RU'),
      confirmed: false,
    });
  }

  const stableAppetite = transcript.match(/(?:ест|кушает|аппетит)\s+(?:как\s+)?обычн[а-яё]*/i);
  const lowerAppetite = transcript.match(/(?:ест|кушает)\s+(?:заметно\s+)?(?:меньше|хуже)|не\s+(?:ест|ела)|аппетит\s+(?:хуже|ниже)/i);
  const appetite = lowerAppetite || stableAppetite;
  if (appetite) {
    candidates.push({
      id: `${input.captureId}:appetite`,
      captureId: input.captureId,
      petId: input.petId,
      metric: 'appetite',
      value: lowerAppetite ? (/не\s+(?:ест|ела)/i.test(lowerAppetite[0]) ? 'не ела' : 'ест меньше') : 'как обычно',
      direction: lowerAppetite ? 'down' : 'stable',
      observedAt: input.observedAt,
      onsetAt: onsetFromTranscript(appetite[0], input.observedAt) || (/сегодня/i.test(transcript) ? input.observedAt : null),
      authorId: input.authorId,
      source: 'voice',
      confidence: 0.9,
      transcriptSpan: appetite[0].toLocaleLowerCase('ru-RU').replace(/^кушает/, 'ест'),
      confirmed: false,
    });
  }

  return candidates;
}

function comparableWindow(left: string, right: string) {
  const leftDate = parseIso(left, 'observed_at');
  const rightDate = parseIso(right, 'observed_at');
  const sameUtcDay = leftDate.toISOString().slice(0, 10) === rightDate.toISOString().slice(0, 10);
  return sameUtcDay && Math.abs(leftDate.getTime() - rightDate.getTime()) <= 12 * 60 * 60 * 1000;
}

function latestComparableObservation(candidate: ObservationCandidate, existing: ExistingStructuredObservation[]) {
  return existing
    .filter((item) => item.petId === candidate.petId && item.metric === candidate.metric && comparableWindow(item.observedAt, candidate.observedAt))
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];
}

function decisionFor(candidate: ObservationCandidate, existing: ExistingStructuredObservation[]): IngestionDecision {
  if (!candidate.confirmed) {
    return { candidateId: candidate.id, operation: 'noop', analyticsEligible: false, reason: 'confirmation_required' };
  }
  if (candidate.confidence < MIN_AUTO_SAVE_CONFIDENCE) {
    return { candidateId: candidate.id, operation: 'noop', analyticsEligible: false, reason: 'confidence_too_low' };
  }

  parseIso(candidate.observedAt, 'observed_at');
  if (candidate.onsetAt) parseIso(candidate.onsetAt, 'onset_at');
  const target = latestComparableObservation(candidate, existing);
  const analyticsEligible = Boolean(candidate.onsetAt) && candidate.direction !== 'unknown';

  if (!target) {
    return { candidateId: candidate.id, operation: 'create', analyticsEligible, reason: 'no_comparable_observation' };
  }

  const directionsConflict = target.direction !== 'unknown'
    && candidate.direction !== 'unknown'
    && target.direction !== candidate.direction;
  if (directionsConflict && target.authorId !== candidate.authorId) {
    return {
      candidateId: candidate.id,
      operation: 'conflict',
      targetObservationId: target.id,
      analyticsEligible: false,
      reason: 'sources_disagree',
    };
  }

  const sameValue = normalizedValue(target.value) === normalizedValue(candidate.value);
  return {
    candidateId: candidate.id,
    operation: sameValue || directionsConflict ? 'update' : 'merge',
    targetObservationId: target.id,
    analyticsEligible,
    reason: sameValue ? 'same_fact_in_window' : directionsConflict ? 'same_author_correction' : 'compatible_fact_in_window',
  };
}

export function planObservationIngestion(input: {
  candidates: ObservationCandidate[];
  existing: ExistingStructuredObservation[];
}): ObservationIngestionPlan {
  if (!input.candidates.length) throw new Error('EMPTY_CANDIDATE_BATCH');
  const petIds = new Set(input.candidates.map((item) => item.petId));
  const captureIds = new Set(input.candidates.map((item) => item.captureId));
  if (petIds.size !== 1) throw new Error('MIXED_PET_BATCH');
  if (captureIds.size !== 1) throw new Error('MIXED_CAPTURE_BATCH');

  const decisions = input.candidates.map((candidate) => decisionFor(candidate, input.existing));
  const count = (operation: IngestionOperation) => decisions.filter((item) => item.operation === operation).length;
  return {
    petId: input.candidates[0].petId,
    captureId: input.candidates[0].captureId,
    decisions,
    summary: {
      candidates: decisions.length,
      create: count('create'),
      update: count('update'),
      merge: count('merge'),
      conflict: count('conflict'),
      noop: count('noop'),
      notesCreated: 0,
    },
  };
}

export function ingestionFingerprint(candidates: ObservationCandidate[]) {
  return JSON.stringify([...candidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => ({
      id: item.id,
      captureId: item.captureId,
      petId: item.petId,
      metric: item.metric,
      value: normalizedValue(item.value),
      direction: item.direction,
      observedAt: item.observedAt,
      onsetAt: item.onsetAt ?? null,
      authorId: item.authorId,
      source: item.source,
      confidence: item.confidence,
      transcriptSpan: item.transcriptSpan,
      confirmed: item.confirmed,
    })));
}
