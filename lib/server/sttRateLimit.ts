export class SttRateLimitError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'SttRateLimitError';
  }
}

export async function claimSttCapacity(input: { supabase: any; ownerId: string }) {
  const result = await input.supabase.rpc('claim_stt_request', { p_owner_id: input.ownerId });
  if (result.error) {
    const message = String(result.error.message || '');
    if (message.includes('STT_RATE_LIMITED')) throw new SttRateLimitError('STT_RATE_LIMITED');
    throw new SttRateLimitError('STT_RATE_LIMIT_UNAVAILABLE');
  }
  const remaining = Number(result.data);
  if (!Number.isFinite(remaining) || remaining < 0) throw new SttRateLimitError('STT_RATE_LIMIT_UNAVAILABLE');
  return remaining;
}
