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
 * MongoDB-based rate limiter for OTP send endpoint.
 * Uses hourly buckets keyed by phone number.
 * @param phone - The phone number to rate limit
 * @param action - 'send' only (verify uses progressive blocking)
 */
export async function checkOtpRateLimit(phone: string, action: 'send'): Promise<void> {
  const { connect } = await import('@/lib/mongodb')
  const RateLimitModel = (await import('@/models/RateLimit')).default

  await connect()

  // Create hourly bucket key
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000))
  const key = `otp:${action}:${phone}:${hourBucket}`

  // Limit: 5 sends per hour
  const limit = 5

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
    throw new TooManyRequestsError(`Rate limit exceeded. Max ${limit} OTP send attempts per hour.`)
  }
}

/**
 * Progressive OTP blocking for verify attempts.
 * - After 3 failed attempts: blocked for 1 hour
 * - After next 3 failed attempts: blocked for 2 hours (doubles)
 * - Block period doubles after each cycle of 3 failures
 * - Resets completely on successful login
 * 
 * @param phone - The phone number to check
 * @throws TooManyRequestsError if phone is blocked
 */
export async function checkOtpBlock(phone: string): Promise<void> {
  const { connect } = await import('@/lib/mongodb')
  const OtpBlockModel = (await import('@/models/OtpBlock')).default

  await connect()

  const record = await OtpBlockModel.findOne({ phone })

  if (!record) {
    // No record = not blocked
    return
  }

  // Check if currently blocked
  if (record.blockUntil && record.blockUntil > new Date()) {
    const remainingMs = record.blockUntil.getTime() - Date.now()
    const remainingMins = Math.ceil(remainingMs / (60 * 1000))
    const remainingHours = Math.floor(remainingMins / 60)
    const mins = remainingMins % 60

    let timeStr: string
    if (remainingHours > 0) {
      timeStr = mins > 0 ? `${remainingHours}h ${mins}m` : `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`
    } else {
      timeStr = `${remainingMins} minute${remainingMins > 1 ? 's' : ''}`
    }

    throw new TooManyRequestsError(
      `Too many failed attempts. Please try again in ${timeStr}.`
    )
  }
}

/**
 * Record a failed OTP verification attempt.
 * Implements progressive blocking:
 * - 3 failures = 1 hour block
 * - Next 3 failures = 2 hour block
 * - Block duration doubles each cycle
 * 
 * @param phone - The phone number that failed
 */
export async function recordOtpFailure(phone: string): Promise<void> {
  const { connect } = await import('@/lib/mongodb')
  const OtpBlockModel = (await import('@/models/OtpBlock')).default

  await connect()

  const now = new Date()

  // Get or create record
  let record = await OtpBlockModel.findOne({ phone })

  if (!record) {
    record = new OtpBlockModel({
      phone,
      failedAttempts: 1,
      totalFailures: 1,
      blockCount: 0,
      blockUntil: null,
      lastFailureAt: now,
    })
    await record.save()
    return
  }

  // If block has expired, we're counting new failures within this block cycle
  // but we keep the blockCount for doubling the duration
  if (record.blockUntil && record.blockUntil <= now) {
    // Block expired, reset failedAttempts for new cycle but keep blockCount
    record.failedAttempts = 0
    record.blockUntil = null // Clear expired block so we don't keep resetting
  }

  // Increment counters
  record.failedAttempts += 1
  record.totalFailures += 1
  record.lastFailureAt = now

  // Check if we hit 3 failures - time to block
  if (record.failedAttempts >= 3) {
    record.blockCount += 1
    record.failedAttempts = 0 // Reset for next cycle

    // Calculate block duration: 1 hour * 2^(blockCount-1)
    // blockCount 1 = 1 hour, blockCount 2 = 2 hours, blockCount 3 = 4 hours, etc.
    const blockHours = Math.pow(2, record.blockCount - 1)
    const blockDurationMs = blockHours * 60 * 60 * 1000

    record.blockUntil = new Date(now.getTime() + blockDurationMs)

    console.log(
      `[OTP Block] Phone ${phone} blocked for ${blockHours} hour(s) after ${record.totalFailures} total failures (block #${record.blockCount})`
    )
  }

  await record.save()
}

/**
 * Reset OTP block record on successful login.
 * Clears all failure counters and blocks.
 * 
 * @param phone - The phone number that successfully logged in
 */
export async function resetOtpBlock(phone: string): Promise<void> {
  const { connect } = await import('@/lib/mongodb')
  const OtpBlockModel = (await import('@/models/OtpBlock')).default

  await connect()

  // Delete the record entirely on successful login
  await OtpBlockModel.deleteOne({ phone })
}
