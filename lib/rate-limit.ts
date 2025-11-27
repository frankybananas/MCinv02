import { TooManyRequestsError } from './errors'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
  onLimitHit?: (key: string) => void
}

const counters = new Map<string, { count: number; expiresAt: number }>()

/**
 * In-memory rate limiter - useful for non-critical routes.
 * Note: Does not persist across serverless invocations.
 */
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

/**
 * MongoDB-based rate limiter for OTP endpoints.
 * Uses hourly buckets keyed by phone number.
 * @param phone - The phone number to rate limit
 * @param action - 'send' or 'verify'
 * @returns true if allowed, throws TooManyRequestsError if rate limited
 */
export async function checkOtpRateLimit(phone: string, action: 'send' | 'verify'): Promise<void> {
  // Lazy import to avoid circular deps and allow use in edge-compatible contexts
  const { connect } = await import('@/lib/mongodb')
  const RateLimitModel = (await import('@/models/RateLimit')).default

  await connect()

  // Create hourly bucket key
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000))
  const key = `otp:${action}:${phone}:${hourBucket}`

  // Limits: 5 sends per hour, 10 verifies per hour
  const limit = action === 'send' ? 5 : 10

  // TTL: end of current hour bucket + 1 hour margin
  const expiresAt = new Date((hourBucket + 2) * 60 * 60 * 1000)

  // Upsert and increment counter
  const result = await RateLimitModel.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    { upsert: true, new: true }
  )

  if (result.count > limit) {
    throw new TooManyRequestsError(`Rate limit exceeded. Max ${limit} ${action} attempts per hour.`)
  }
}
