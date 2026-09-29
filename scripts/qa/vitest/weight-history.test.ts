import { describe, expect, it } from 'vitest';
import { buildWeightHistory, formatProfileDate, parseWeightKg } from '@/lib/weightHistory';
import { buildPetProfilePersistencePayload } from '@/lib/server/profileService';

describe('weight history', () => {
  it('parses imported weight values with comma, dot and units', () => {
    expect(parseWeightKg('14 кг')).toBe(14);
    expect(parseWeightKg('4,25 kg')).toBe(4.25);
    expect(parseWeightKg('weight: 13.2')).toBe(13.2);
    expect(parseWeightKg('unknown')).toBeNull();
  });

  it('keeps only valid weight observations and sorts them chronologically', () => {
    const history = buildWeightHistory([
      { id: 'latest', type: 'weight', value: '14 kg', observedAt: '2026-09-17T12:00:00Z' },
      { id: 'mood', type: 'mood', value: 'calm', observedAt: '2026-08-01T12:00:00Z' },
      { id: 'first', type: 'weight', value: '4,25', observedAt: '2026-07-22T12:00:00Z' },
    ]);
    expect(history.map((item) => item.id)).toEqual(['first', 'latest']);
    expect(history.map((item) => item.valueKg)).toEqual([4.25, 14]);
  });

  it('formats a date-only profile value without changing its calendar day', () => {
    expect(formatProfileDate('2026-05-30')).toContain('30');
    expect(formatProfileDate('not-a-date')).toBe('');
  });

  it('persists the exact birth and home-arrival dates', () => {
    const { petPayload } = buildPetProfilePersistencePayload({
      user: { id: 'owner-1' },
      profile: {
        dogName: 'Батат',
        birthDate: '2026-05-30',
        homeArrivalDate: '2026-07-20',
      },
    });

    expect(petPayload.birth_date).toBe('2026-05-30');
    expect(petPayload.home_arrival_date).toBe('2026-07-20');
  });
});
