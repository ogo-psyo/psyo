import { beforeEach, expect, test, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('@/lib/server/auth', () => ({ ensureProfile: vi.fn(async () => {}) }));
import { savePetProfile, createPetProfileIdempotently } from '@/lib/server/profileService';
const rpc = vi.fn();
const client = { rpc, from: vi.fn(() => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: {}, error: null }) }; return query; }) } as unknown as SupabaseClient;
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { pet: { id: 'pet-a' } }, error: null }); });
test('whole-profile update is one RPC with server owner and expected version', async () => {
  await savePetProfile({ supabase: client, user: { id: 'owner-a' }, profile: { dogName: 'Bim', backendPetId: 'pet-a', profileVersion: 4, diet: 'Food' }, idempotencyKey: 'profile-update' });
  expect(rpc).toHaveBeenCalledWith('update_pet_profile_atomic', expect.objectContaining({ p_owner_id: 'owner-a', p_expected_version: 4, p_pet_id: 'pet-a', p_passport: expect.objectContaining({ diet: 'Food' }) }));
  expect(client.from).not.toHaveBeenCalled();
});
test('creation retry has stable public slug and fingerprint', async () => {
  const input = { supabase: client, user: { id: 'owner-a' }, profile: { dogName: 'Bim' }, idempotencyKey: 'new-pet-request' };
  await createPetProfileIdempotently(input);
  await createPetProfileIdempotently(input);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
