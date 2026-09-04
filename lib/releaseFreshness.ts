const releaseQueryKey = '_pso_release';

function normalizedRelease(value: string | null | undefined) {
  const release = value?.trim();
  return release || null;
}

export function hasReleaseChanged(current: string | null | undefined, latest: string | null | undefined) {
  const currentRelease = normalizedRelease(current);
  const latestRelease = normalizedRelease(latest);
  return Boolean(currentRelease && latestRelease && currentRelease !== latestRelease);
}

export function buildFreshReleaseUrl(href: string, release: string) {
  const url = new URL(href);
  url.searchParams.set(releaseQueryKey, release.trim().slice(0, 12));
  return url.toString();
}

export function releaseMarkerMatches(href: string, release: string) {
  const marker = new URL(href).searchParams.get(releaseQueryKey);
  return marker === release.trim().slice(0, 12);
}
