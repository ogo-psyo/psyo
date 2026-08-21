const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_STT_MODEL = 'whisper-large-v3-turbo';
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export type GroqSttDependencies = {
  apiKey: string | undefined;
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};

export class GroqSttError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'GroqSttError';
  }
}

export function groqSttAvailability(env: Record<string, string | undefined> = process.env) {
  return env.GROQ_API_KEY?.trim()
    ? { available: true as const }
    : { available: false as const, reason: 'STT_NOT_CONFIGURED' as const };
}

function audioDescriptor(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (normalized === 'audio/webm') return { mimeType: normalized, extension: 'webm' };
  if (normalized === 'audio/ogg') return { mimeType: normalized, extension: 'ogg' };
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return { mimeType: normalized, extension: 'm4a' };
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return { mimeType: normalized, extension: 'wav' };
  throw new GroqSttError('UNSUPPORTED_AUDIO_TYPE');
}

function usableTranscript(value: unknown) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const normalized = text.toLocaleLowerCase('ru-RU').replace(/[.!,]/g, '').trim();
  const silenceOutputs = new Set(['', '[музыка]', '(музыка)', '[тишина]', '(тишина)', 'субтитры']);
  if (silenceOutputs.has(normalized)) throw new GroqSttError('NO_SPEECH_DETECTED');
  return text;
}

function providerError(status: number) {
  if (status === 429) return new GroqSttError('STT_QUOTA_EXHAUSTED');
  if (status === 401 || status === 403) return new GroqSttError('STT_PROVIDER_AUTH_FAILED');
  if (status === 400 || status === 413 || status === 422) return new GroqSttError('INVALID_AUDIO');
  return new GroqSttError('STT_PROVIDER_UNAVAILABLE');
}

export async function transcribeGroqAudio(
  input: { bytes: Uint8Array; mimeType: string; language?: string },
  dependencies: GroqSttDependencies = {
    apiKey: process.env.GROQ_API_KEY,
    fetch: globalThis.fetch.bind(globalThis),
  },
) {
  const descriptor = audioDescriptor(input.mimeType);
  if (!input.bytes.byteLength) throw new GroqSttError('EMPTY_AUDIO');
  if (input.bytes.byteLength > MAX_AUDIO_BYTES) throw new GroqSttError('AUDIO_TOO_LARGE');
  const apiKey = dependencies.apiKey?.trim();
  if (!apiKey) throw new GroqSttError('STT_NOT_CONFIGURED');

  const form = new FormData();
  const audioBuffer = Uint8Array.from(input.bytes).buffer;
  form.set('file', new File([audioBuffer], `voice.${descriptor.extension}`, { type: descriptor.mimeType }));
  form.set('model', GROQ_STT_MODEL);
  form.set('language', input.language || 'ru');
  form.set('response_format', 'verbose_json');
  form.set('temperature', '0');

  let response: Response;
  try {
    response = await dependencies.fetch(GROQ_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
      cache: 'no-store',
    });
  } catch {
    throw new GroqSttError('STT_PROVIDER_UNAVAILABLE');
  }

  if (!response.ok) throw providerError(response.status);
  const payload = await response.json().catch(() => null) as { text?: unknown; duration?: unknown } | null;
  if (!payload) throw new GroqSttError('STT_PROVIDER_INVALID_RESPONSE');
  const duration = Number(payload.duration);
  return {
    text: usableTranscript(payload.text),
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : 0,
  };
}
