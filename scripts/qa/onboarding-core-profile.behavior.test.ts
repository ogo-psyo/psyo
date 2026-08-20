import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCreatePetInput } from '../../packages/contracts/index.ts';
import { createPet } from '../../lib/server/onboardingService.ts';

test('onboarding validates and preserves the dog core profile', () => {
  const result = validateCreatePetInput({
    name: ' Боня ',
    lifeStage: 'adult',
    sex: 'female',
    breedId: 'corgi',
    breedGroupId: 'herding',
    idempotencyKey: 'create-pet:bonya-1',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.input, {
    name: 'Боня',
    lifeStage: 'adult',
    sex: 'female',
    breedId: 'corgi',
    breedGroupId: 'herding',
    idempotencyKey: 'create-pet:bonya-1',
  });
});

test('onboarding persists the same core profile through the owner-scoped RPC', async () => {
  const rpcCalls: Array<Record<string, unknown>> = [];
  const supabase = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push(args);
      return { data: { replayed: false, pet: { id: 'pet-1' } }, error: null };
    },
  };

  await createPet({
    supabase: supabase as never,
    ownerId: 'owner-1',
    name: 'Боня',
    lifeStage: 'adult',
    sex: 'female',
    breedId: 'corgi',
    breedGroupId: 'herding',
    idempotencyKey: 'create-pet:bonya-1',
  });

  const petPayload = rpcCalls[0]?.p_pet as Record<string, unknown>;
  assert.equal(petPayload.owner_id, 'owner-1');
  assert.equal(petPayload.name, 'Боня');
  assert.equal(petPayload.species, 'dog');
  assert.equal(petPayload.breed_id, 'corgi');
  assert.equal(petPayload.breed_group_id, 'herding');
  assert.equal(petPayload.sex, 'female');
  assert.equal(petPayload.life_stage, 'adult');
});
