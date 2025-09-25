import { TooManyRequestsError } from './errors'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
  onLimitHit?: (key: string) => void
}

const counters = new Map<string, { count: number; expiresAt: number }>()

export function assertRateLimit({ key, limit, windowMs, onLimitHit }: RateLimitOptions): void {
  const now = Date.now()
  const existing = counters.get(key)

  if (!existing || existing.expiresAt <= now) {
    counters.set(key, { count: 1, expiresAt: now + windowMs })
    return
  }

  existing.count += 1
  if (existing.count > limit) {
    if (onLimitHit) onLimitHit(key)
    throw new TooManyRequestsError()
  }
}
