const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.6-27b';

export type GroqAssistantDependencies = {
  apiKey?: string;
  enabled?: boolean;
  model?: string;
  fetch: typeof fetch;
};

export class GroqAssistantError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'GroqAssistantError';
  }
}

export function groqAssistantAvailability(input: { enabled?: boolean; apiKey?: string } = {
  enabled: ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSISTANT_GROQ_ENABLED || '').toLowerCase()),
  apiKey: process.env.GROQ_API_KEY,
}) {
  if (!input.enabled) return { available: false as const, reason: 'ASSISTANT_LLM_DISABLED' };
  if (!input.apiKey?.trim()) return { available: false as const, reason: 'ASSISTANT_LLM_NOT_CONFIGURED' };
  return { available: true as const };
}

function defaultDependencies(): GroqAssistantDependencies {
  return {
    apiKey: process.env.GROQ_API_KEY,
    enabled: ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSISTANT_GROQ_ENABLED || '').toLowerCase()),
    model: process.env.GROQ_ASSISTANT_MODEL || DEFAULT_MODEL,
    fetch,
  };
}

export async function generateGroqAssistantAnswer(
  input: { system: string; prompt: string },
  dependencies: GroqAssistantDependencies = defaultDependencies(),
) {
  const availability = groqAssistantAvailability(dependencies);
  if (!availability.available) throw new GroqAssistantError(availability.reason);
  let response: Response;
  try {
    response = await dependencies.fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dependencies.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: dependencies.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: input.system.slice(0, 4000) },
          { role: 'user', content: input.prompt.slice(0, 6000) },
        ],
        temperature: 0.1,
        max_completion_tokens: 700,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GroqAssistantError('ASSISTANT_PROVIDER_UNAVAILABLE');
  }

  if (response.status === 429) throw new GroqAssistantError('ASSISTANT_QUOTA_EXHAUSTED');
  if (response.status === 401 || response.status === 403) throw new GroqAssistantError('ASSISTANT_PROVIDER_AUTH_FAILED');
  if (!response.ok) throw new GroqAssistantError('ASSISTANT_PROVIDER_UNAVAILABLE');

  const payload = await response.json().catch(() => null) as any;
  const text = String(payload?.choices?.[0]?.message?.content || '').trim();
  if (!text || text.length > 1800) throw new GroqAssistantError('ASSISTANT_INVALID_RESPONSE');
  return {
    text,
    usage: {
      inputTokens: Number(payload?.usage?.prompt_tokens) || 0,
      outputTokens: Number(payload?.usage?.completion_tokens) || 0,
    },
  };
}
