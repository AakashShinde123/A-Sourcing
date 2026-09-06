// @es/core · rate-limit — in-memory sliding-window limiter for auth endpoints.
// Sized for the single-instance SQLite deployment (see DEPLOYMENT.md §Auth);
// swap the Map for Redis when scaling to multiple instances.

const failures = new Map<string, number[]>()
const attempts = new Map<string, number[]>()

export const LOGIN_MAX_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const IP_MAX_ATTEMPTS = 100 // broad spray guard across all emails (headroom for CI suites)
export const IP_WINDOW_MS = 15 * 60 * 1000

function slide(map: Map<string, number[]>, key: string, windowMs: number): number[] {
  const now = Date.now()
  const hits = (map.get(key) ?? []).filter((t) => now - t < windowMs)
  map.set(key, hits)
  return hits
}

/** Per-email lockout — only failed attempts count, so real users never trip it. */
export function checkLockout(key: string): { locked: boolean; retryAfterSec: number } {
  const hits = slide(failures, key, LOGIN_WINDOW_MS)
  if (hits.length < LOGIN_MAX_FAILURES) return { locked: false, retryAfterSec: 0 }
  const oldest = hits[0]
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (Date.now() - oldest)) / 1000)) }
}

export function recordFailure(key: string): void {
  slide(failures, key, LOGIN_WINDOW_MS).push(Date.now())
}

export function clearFailures(key: string): void {
  failures.delete(key)
}

/** Per-IP attempt budget — every login POST counts (brute-force spray guard). */
export function checkIpBudget(key: string): { allowed: boolean; retryAfterSec: number } {
  const hits = slide(attempts, key, IP_WINDOW_MS)
  if (hits.length >= IP_MAX_ATTEMPTS) {
    const oldest = hits[0]
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((IP_WINDOW_MS - (Date.now() - oldest)) / 1000)) }
  }
  hits.push(Date.now())
  return { allowed: true, retryAfterSec: 0 }
}
