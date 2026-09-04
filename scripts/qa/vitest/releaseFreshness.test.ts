import { describe, expect, it } from 'vitest';
import { buildFreshReleaseUrl, hasReleaseChanged, releaseMarkerMatches } from '../../../lib/releaseFreshness';

describe('release freshness', () => {
  it('reloads only when both release ids exist and differ', () => {
    expect(hasReleaseChanged('release-a', 'release-a')).toBe(false);
    expect(hasReleaseChanged('release-a', 'release-b')).toBe(true);
    expect(hasReleaseChanged('', 'release-b')).toBe(false);
    expect(hasReleaseChanged('release-a', null)).toBe(false);
  });

  it('creates a cache-busting URL without losing route state', () => {
    const nextUrl = buildFreshReleaseUrl('https://pso.test/?demo=1#all', 'ead3447f12d39578e');
    expect(nextUrl).toBe('https://pso.test/?demo=1&_pso_release=ead3447f12d3#all');
    expect(releaseMarkerMatches(nextUrl, 'ead3447f12d39578e')).toBe(true);
    expect(releaseMarkerMatches(nextUrl, 'another-release')).toBe(false);
  });
});
