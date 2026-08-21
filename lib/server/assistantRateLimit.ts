export class AssistantRateLimitError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AssistantRateLimitError';
  }
}

export async function claimAssistantCapacity(input: { supabase: any; ownerId: string }) {
  const result = await input.supabase.rpc('claim_assistant_request', { p_owner_id: input.ownerId });
  if (result.error) {
    const message = String(result.error.message || '');
    if (message.includes('ASSISTANT_RATE_LIMITED')) throw new AssistantRateLimitError('ASSISTANT_RATE_LIMITED');
    throw new AssistantRateLimitError('ASSISTANT_RATE_LIMIT_UNAVAILABLE');
  }
  const remaining = Number(result.data);
  if (!Number.isFinite(remaining) || remaining < 0) throw new AssistantRateLimitError('ASSISTANT_RATE_LIMIT_UNAVAILABLE');
  return remaining;
}
