import { describe, expect, it } from 'vitest';
import { breedDirectory, breedInputValue, breedProfilePatch, normalizeBreed, searchBreeds } from '../../../lib/breedSearch';

describe('breed directory compatibility', () => {
  it('finds Russian, English and familiar names without selecting a default', () => {
    expect(searchBreeds('')).toEqual([]);
    expect(searchBreeds('white swiss')[0].title).toBe('Белая швейцарская овчарка');
    expect(searchBreeds('ксоло')[0].title).toBe('Ксолоитцкуинтли');
    expect(searchBreeds('йорк')[0].legacy?.id).toBe('yorkshire-terrier');
    expect(searchBreeds('боксер')[0].legacy?.id).toBe('boxer');
  });
  it('keeps existing breed identity and distinguishes specific varieties', () => {
    expect(breedProfilePatch('Ксолоитцкуинтли').breedId).toBe('xoloitzcuintli');
    expect(breedProfilePatch('Ксолоитцкуинтли / ксоло').breedId).toBe('xoloitzcuintli');
    expect(breedProfilePatch('Корги').breedId).toBe('corgi');
    const variant = breedProfilePatch('Вельш корги кардиган');
    expect(variant.breedId).toBe('custom');
    expect(breedInputValue(variant)).toBe('Вельш корги кардиган');
  });
  it('roundtrips new directory names, mixed and unlisted breeds through existing fields', () => {
    for (const name of ['Белая швейцарская овчарка', 'Австралийский лабрадудль', 'Метис']) {
      expect(breedInputValue(breedProfilePatch(name))).toBe(name);
    }
    expect(breedInputValue(breedProfilePatch(''))).toBe('');
  });
  it('has no duplicate display names, preserves all source varieties and fits field limits', () => {
    expect(breedDirectory.length).toBeGreaterThanOrEqual(450);
    expect(new Set(breedDirectory.map(item => normalizeBreed(item.title))).size).toBe(breedDirectory.length);
    expect(breedDirectory.every(item => item.title.length <= 80 && item.aliases.length > 0)).toBe(true);
    expect(searchBreeds('чихуахуа').some(item => item.title.includes('длинная шерсть'))).toBe(true);
  });
});
