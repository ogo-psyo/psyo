import { expect, test } from 'vitest';
import { defaultProfile } from '@/lib/data';
import { mergeProfileDraft } from '@/lib/profileMerge';
test('disjoint edits merge without losing either device changes', () => {
  const base = { ...defaultProfile, dogName: 'Bim', profileVersion: 0 };
  const local = { ...base, diet: 'Local diet' };
  const remote = { ...base, allergies: 'Remote allergy', profileVersion: 1 };
  const result = mergeProfileDraft(base, local, remote);
  expect(result.conflicts).toEqual([]);
  expect(result.merged).toMatchObject({ diet: 'Local diet', allergies: 'Remote allergy', profileVersion: 1 });
});
test('overlapping edit remains an explicit choice; matching edits are not conflicts', () => {
  const base = { ...defaultProfile, dogName: 'Bim' };
  const result = mergeProfileDraft(base, { ...base, diet: 'Local', weight: '10' }, { ...base, diet: 'Remote', weight: '10' });
  expect(result.conflicts).toEqual(['diet']);
  expect(result.local.diet).toBe('Local'); expect(result.remote.diet).toBe('Remote');
});
test('missing baseline never silently replaces different fields', () => {
  const result = mergeProfileDraft(undefined, { ...defaultProfile, diet: 'Local' }, { ...defaultProfile, diet: 'Remote' });
  expect(result.conflicts).toEqual(['diet']);
});
