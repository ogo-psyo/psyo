import { generateGroqAssistantAnswer, groqAssistantAvailability } from './groqAssistant';
import { claimAssistantCapacity } from './assistantRateLimit';

export type AssistantKind = 'health_triage' | 'training' | 'care' | 'shopping' | 'general';

type Dependencies = {
  availability: typeof groqAssistantAvailability;
  claim: typeof claimAssistantCapacity;
  generate: typeof generateGroqAssistantAnswer;
};

const defaultDependencies: Dependencies = {
  availability: groqAssistantAvailability,
  claim: claimAssistantCapacity,
  generate: generateGroqAssistantAnswer,
};

function unsafeAnswer(value: string) {
  return /(?:дайте|принимайте|дозировка|доза)[^.!?\n]{0,50}\b\d+(?:[.,]\d+)?\s*(?:мг|мл|табл)/i.test(value)
    || /(?:точно|однозначно)\s+(?:диагноз|это\s+[а-яё-]+)/i.test(value)
    || /\|\s*-{3,}\s*\|/.test(value);
}

export async function generateGuardedAssistantAnswer(input: {
  ownerId: string | null;
  kind: AssistantKind;
  rulesAnswer: string;
  prompt: string;
  supabase: any;
}, dependencies: Dependencies = defaultDependencies) {
  const rules = (mode: string, reason?: string) => ({
    answer: input.rulesAnswer,
    provider: 'rules' as const,
    mode,
    safetyLevel: input.kind === 'health_triage' ? 'vet_boundary' as const : 'bounded_rules' as const,
    confidence: 'rules_based' as const,
    sourceBasis: 'owner_profile_and_care_rules' as const,
    ...(reason ? { reason } : {}),
  });

  if (input.kind === 'health_triage') return rules('rules_health_boundary');
  if (!input.ownerId) return rules('rules_guest');
  const availability = dependencies.availability();
  if (!availability.available) return rules('rules_llm_unavailable', availability.reason);

  try {
    await dependencies.claim({ supabase: input.supabase, ownerId: input.ownerId });
    const generated = await dependencies.generate({ system: ASSISTANT_SYSTEM_PROMPT, prompt: input.prompt });
    if (unsafeAnswer(generated.text)) return rules('rules_fallback_unsafe_output', 'ASSISTANT_UNSAFE_RESPONSE');
    return {
      answer: generated.text,
      provider: 'groq' as const,
      mode: 'groq_contextual',
      safetyLevel: 'non_medical_guidance' as const,
      confidence: 'contextual_guidance' as const,
      sourceBasis: 'owner_profile_and_active_care_context' as const,
      usage: generated.usage,
    };
  } catch (error) {
    const code = String((error as { code?: string })?.code || 'ASSISTANT_PROVIDER_UNAVAILABLE');
    return rules(`rules_fallback_${code.toLowerCase()}`, code);
  }
}

export const ASSISTANT_SYSTEM_PROMPT = [
  'Ты ассистент Псё для владельца собаки. Отвечай по-русски ясно и коротко.',
  'Опирайся только на переданный контекст. Не выдумывай факты, диагнозы, дозировки и назначения.',
  'Не обещай, что состояние безопасно. Если контекста мало, задай не более двух связанных уточняющих вопросов.',
  'Не создавай действия и не утверждай, что что-либо сохранено: действия формирует и подтверждает backend Псё.',
  'Формат: короткий вывод, затем 2–5 практичных пунктов. Без markdown-таблиц.',
].join(' ');
