import { extractObservationCandidates, type ObservationCandidate, type ObservationMetric } from '@/lib/observationIngestion';
import { claimAssistantCapacity } from './assistantRateLimit';
import { generateGroqAssistantAnswer, groqAssistantAvailability } from './groqAssistant';

type Input = {
  transcript: string;
  captureId: string;
  petId: string;
  authorId: string;
  observedAt: string;
  source: 'voice' | 'text';
  supabase: any;
};

type Dependencies = {
  available: typeof groqAssistantAvailability;
  claim: typeof claimAssistantCapacity;
  generate: typeof generateGroqAssistantAnswer;
};

const defaults: Dependencies = { available: groqAssistantAvailability, claim: claimAssistantCapacity, generate: generateGroqAssistantAnswer };
const metrics = new Set<ObservationMetric>(['mood', 'energy', 'appetite', 'stool', 'sleep']);
const directions = new Set(['up', 'down', 'stable', 'unknown']);

function onsetAt(onset: unknown, observedAt: string) {
  const observed = new Date(observedAt);
  if (onset === 'today') return observed.toISOString();
  if (onset === 'yesterday') return new Date(observed.getTime() - 86_400_000).toISOString();
  return null;
}

function supportedValue(metric: ObservationMetric, span: string, proposed: string) {
  const value = span.toLocaleLowerCase('ru-RU').trim();
  if (metric === 'appetite') {
    if (/не\s+(?:ест|ел|ела)|отказ/.test(value)) return 'не ела';
    if (/меньше|хуже/.test(value)) return 'ест меньше';
    if (/обычн/.test(value)) return 'как обычно';
    if (/активно|хорошо|с\s+аппетитом/.test(value)) return 'поела хорошо';
  }
  if (metric === 'energy') {
    if (/больше\s+спит|менее\s+актив|вял|уста/.test(value)) return /спит/.test(value) ? 'спит больше обычного' : 'менее активна';
    if (/бодр|энергич/.test(value)) return value;
  }
  if (metric === 'mood' || metric === 'stool' || metric === 'sleep') return value;
  return value.includes(proposed.toLocaleLowerCase('ru-RU').trim()) ? proposed : value;
}

function parseCandidates(text: string, input: Input): ObservationCandidate[] {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const payload = JSON.parse(clean) as { candidates?: unknown[] };
  if (!Array.isArray(payload.candidates)) return [];
  const transcriptLower = input.transcript.toLocaleLowerCase('ru-RU');
  return payload.candidates.slice(0, 6).flatMap((raw: any, index) => {
    const metric = String(raw?.metric || '') as ObservationMetric;
    const direction = String(raw?.direction || 'unknown') as ObservationCandidate['direction'];
    const proposedValue = String(raw?.value || '').trim().slice(0, 120);
    const transcriptSpan = String(raw?.transcriptSpan || '').trim().slice(0, 200);
    const confidence = Number(raw?.confidence);
    if (!metrics.has(metric) || !directions.has(direction) || !proposedValue || !transcriptSpan || confidence < 0.8 || confidence > 1) return [];
    if (!transcriptLower.includes(transcriptSpan.toLocaleLowerCase('ru-RU'))) return [];
    const value = supportedValue(metric, transcriptSpan, proposedValue).slice(0, 120);
    return [{
      id: `${input.captureId}:${metric}:${index}`, captureId: input.captureId, petId: input.petId,
      metric, value, direction, observedAt: new Date(input.observedAt).toISOString(), onsetAt: onsetAt(raw?.onset, input.observedAt),
      authorId: input.authorId, source: input.source, confidence, transcriptSpan, confirmed: false,
    }];
  });
}

export async function extractStructuredObservations(input: Input, dependencies: Dependencies = defaults) {
  const fallback = () => extractObservationCandidates(input);
  const availability = dependencies.available();
  if (!availability.available) return { candidates: fallback(), provider: 'rules' as const, mode: 'deterministic_fallback', reason: availability.reason };
  try {
    await dependencies.claim({ supabase: input.supabase, ownerId: input.authorId });
    const generated = await dependencies.generate({
      system: 'Извлекай только явно сказанные факты о собаке. Верни JSON object {"candidates":[]}. Не додумывай значения, симптомы и время.',
      prompt: `Текст: ${input.transcript.slice(0, 600)}\nДля каждого кандидата: metric mood|energy|appetite|stool|sleep; value; direction up|down|stable|unknown; transcriptSpan — точная цитата; onset today|yesterday|unknown; confidence 0..1. Активность и бодрость относятся к energy.`,
    });
    const candidates = parseCandidates(generated.text, input);
    return { candidates: candidates.length ? candidates : fallback(), provider: 'groq' as const, mode: candidates.length ? 'structured_groq' : 'structured_groq_validated_fallback', usage: generated.usage };
  } catch (error) {
    return { candidates: fallback(), provider: 'rules' as const, mode: 'deterministic_fallback', reason: String((error as { code?: string })?.code || 'EXTRACTION_PROVIDER_UNAVAILABLE') };
  }
}
