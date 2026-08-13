export const CONTACT_CACHE_FRESH_MS = 6 * 60 * 60 * 1000;
export const CONTACT_CACHE_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function contactCacheFreshness(fetchedAt: Date, now = Date.now()) {
  const age = Math.max(0, now - fetchedAt.getTime());
  if (age <= CONTACT_CACHE_FRESH_MS) return "fresh" as const;
  if (age <= CONTACT_CACHE_STALE_MS) return "stale" as const;
  return "expired" as const;
}
