#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  domain: readFileSync('lib/domain.ts', 'utf8'),
  bootstrap: readFileSync('app/api/app/bootstrap/route.ts', 'utf8'),
  page: readFileSync('app/page.tsx', 'utf8'),
};

const failures = [];

for (const token of [
  'pets?: Pet[]',
]) {
  if (!files.domain.includes(token)) failures.push(`domain multi-dog contract missing: ${token}`);
}

for (const token of [
  "supabase.from('pets').select('*').eq('owner_id', ownerId)",
  "const requestedPetId = url.searchParams.get('petId')",
  'const selectedPet = requestedPetId ? pets.find',
  'PET_NOT_FOUND_OR_NOT_OWNED',
  'pets,',
  'activePetId: petId',
]) {
  if (!files.bootstrap.includes(token)) failures.push(`bootstrap multi-dog boundary missing: ${token}`);
}

for (const token of [
  'type PetSwitchOption',
  'const [pets, setPets]',
  'const [activePetId, setActivePetId]',
  'function switchActivePet',
  'const samePet = !petId || current.backendPetId === dbProfile.backendPetId',
  'photos: samePet ? current.photos : []',
  'aria-label="Активная собака"',
  'Профиль, дела, места, вещи и наблюдения ниже относятся только к выбранной собаке',
]) {
  if (!files.page.includes(token)) failures.push(`UI multi-dog switcher missing: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('multi-dog contract ok');
