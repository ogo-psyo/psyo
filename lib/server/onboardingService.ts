import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatePetResult } from '@/packages/contracts';
import { buildPetProfilePersistencePayload } from './profileService';

type PetCreationRpcResult = {
  replayed: boolean;
  pet: Record<string, unknown>;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function createPet(input: {
  supabase: SupabaseClient;
  ownerId: string;
  name: string;
  idempotencyKey: string;
}): Promise<CreatePetResult> {
  const { supabase, ownerId, name, idempotencyKey } = input;
  const normalized = buildPetProfilePersistencePayload({
    user: { id: ownerId, email: null, user_metadata: { provider: 'telegram' } },
    profile: { dogName: name },
  });
  const requestFingerprint = createHash('sha256').update(canonicalJson({ name: name.trim() })).digest('hex');

  const { data, error } = await supabase.rpc('create_pet_for_owner', {
    p_owner_id: ownerId,
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_pet: normalized.petPayload,
    p_passport: normalized.passportPayload,
    p_social: normalized.socialPayload,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('ONBOARDING_ACTIVATION_EMPTY_RESULT');
  const result = data as PetCreationRpcResult;
  const petId = String(result.pet?.id ?? '');
  if (!petId) throw new Error('ONBOARDING_ACTIVATION_EMPTY_RESULT');
  return { petId, created: !result.replayed };
}
