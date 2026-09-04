'use client';

import { useEffect } from 'react';
import { buildFreshReleaseUrl, hasReleaseChanged, releaseMarkerMatches } from '@/lib/releaseFreshness';

type ReleaseResponse = { release?: string | null };

const releaseStorageKey = 'pso:active-release';

export function ReleaseFreshnessGuard() {
  useEffect(() => {
    let checking = false;
    let disposed = false;

    async function checkRelease() {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const response = await fetch('/api/internal/release', { cache: 'no-store' });
        if (!response.ok || disposed) return;
        const payload = await response.json() as ReleaseResponse;
        const latestRelease = payload.release?.trim();
        if (!latestRelease) return;
        const seenRelease = window.sessionStorage.getItem(releaseStorageKey);
        if (!seenRelease || releaseMarkerMatches(window.location.href, latestRelease)) {
          window.sessionStorage.setItem(releaseStorageKey, latestRelease);
          return;
        }
        if (hasReleaseChanged(seenRelease, latestRelease)) {
          window.location.replace(buildFreshReleaseUrl(window.location.href, latestRelease));
        }
      } catch {
        // Release freshness must never block the product when connectivity is poor.
      } finally {
        checking = false;
      }
    }

    function checkVisibleRelease() {
      if (document.visibilityState === 'visible') void checkRelease();
    }

    void checkRelease();
    window.addEventListener('focus', checkVisibleRelease);
    document.addEventListener('visibilitychange', checkVisibleRelease);
    return () => {
      disposed = true;
      window.removeEventListener('focus', checkVisibleRelease);
      document.removeEventListener('visibilitychange', checkVisibleRelease);
    };
  }, []);

  return null;
}
