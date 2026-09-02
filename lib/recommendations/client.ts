import type {
  Recommendation,
  RecommendationAction,
  RecommendationLifecycleCommand,
} from '@/packages/recommendations/contracts';

type Fetcher = typeof fetch;
const defaultFetcher: Fetcher = (input, init) => globalThis.fetch(input, init);

export class RecommendationRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'RecommendationRequestError';
  }
}

function idempotencyKey(action: string) {
  return `recommendation:${action}:${crypto.randomUUID()}`;
}

async function requestJson(input: {
  path: string;
  init: RequestInit;
  fetcher: Fetcher;
  signal?: AbortSignal;
  retries?: number;
}) {
  let lastError: unknown;
  const attempts = (input.retries ?? 1) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await input.fetcher(input.path, { ...input.init, signal: input.signal });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.ok) return payload;
      const code = typeof payload.code === 'string'
        ? payload.code
        : typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
      const error = new RecommendationRequestError(code, response.status);
      if (response.status < 500 || attempt === attempts - 1) throw error;
      lastError = error;
    } catch (error) {
      if (input.signal?.aborted) throw error;
      if (error instanceof RecommendationRequestError && error.status < 500) throw error;
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function loadMainRecommendation(input: {
  petId: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetcher?: Fetcher;
}) {
  const payload = await requestJson({
    path: '/api/recommendations',
    fetcher: input.fetcher ?? defaultFetcher,
    signal: input.signal,
    init: {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...input.headers },
      body: JSON.stringify({ petId: input.petId }),
    },
  });
  return payload.main && typeof payload.main === 'object' ? payload.main as Recommendation : null;
}

export async function transitionRecommendation(input: {
  recommendationId: string;
  command: RecommendationLifecycleCommand;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetcher?: Fetcher;
}) {
  const payload = await requestJson({
    path: `/api/recommendations/${encodeURIComponent(input.recommendationId)}`,
    fetcher: input.fetcher ?? defaultFetcher,
    signal: input.signal,
    init: {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey(input.command.action),
        ...input.headers,
      },
      body: JSON.stringify(input.command),
    },
  });
  if (!payload.recommendation || typeof payload.recommendation !== 'object') {
    throw new RecommendationRequestError('INVALID_RECOMMENDATION_RESPONSE', 502);
  }
  return payload.recommendation as Recommendation;
}

export function recommendationActionLabel(action: RecommendationAction) {
  if (action.intent === 'open_reminder') return 'Открыть дело';
  if (action.intent === 'open_health') return 'Открыть наблюдения';
  if (action.intent === 'open_habits') return 'Добавить привычку';
  if (action.intent === 'plan_walk') return 'Спланировать прогулку';
  if (action.intent === 'add_wishlist') return 'Добавить в вещи';
  if (action.view === 'requests') return 'Ответить';
  if (action.view === 'give_signal') return 'Дать Гав';
  return 'Открыть Гав';
}
