import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingActivationCommand } from '@/packages/contracts';
import { buildPetProfilePersistencePayload } from './profileService';

type ActivationResult = {
  replayed: boolean;
  pet: Record<string, unknown>;
  reminder: Record<string, unknown>;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function activateFirstCareLoop(input: {
  supabase: SupabaseClient;
  ownerId: string;
  idempotencyKey: string;
  command: OnboardingActivationCommand;
}): Promise<ActivationResult> {
  const { supabase, ownerId, idempotencyKey, command } = input;
  const normalized = buildPetProfilePersistencePayload({
    user: { id: ownerId, email: null, user_metadata: { provider: 'telegram' } },
    profile: command.profile,
  });
  const requestFingerprint = createHash('sha256').update(canonicalJson(command)).digest('hex');
  const reminder = {
    type: command.firstReminder.type ?? 'custom',
    title: command.firstReminder.title,
    due_at: command.firstReminder.dueAt,
    recurrence: command.firstReminder.recurrence ?? 'none',
    source: 'onboarding',
  };

  const { data, error } = await supabase.rpc('activate_first_care_loop', {
    p_owner_id: ownerId,
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_pet: normalized.petPayload,
    p_passport: normalized.passportPayload,
    p_social: normalized.socialPayload,
    p_reminder: reminder,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('ONBOARDING_ACTIVATION_EMPTY_RESULT');
  return data as ActivationResult;
}
