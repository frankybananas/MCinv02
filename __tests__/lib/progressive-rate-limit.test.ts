/**
 * Tests for Progressive OTP Rate Limiting
 * 
 * Requirements:
 * - After 3 wrong OTPs: blocked for 1 hour
 * - After next 3 wrong OTPs (while blocked was active): blocked for 2 hours
 * - Block period doubles after each cycle of 3 failures
 * - Resets completely on successful login
 */

import { TooManyRequestsError } from '@/lib/errors'

describe('Progressive OTP Rate Limiting - Logic Tests', () => {
  describe('Block Duration Formula', () => {
    // Test the block duration formula: 1 * 2^(blockCount-1) hours
    const calculateBlockHours = (blockCount: number) => Math.pow(2, blockCount - 1)

    it('should calculate 1 hour for first block', () => {
      expect(calculateBlockHours(1)).toBe(1)
    })

    it('should calculate 2 hours for second block', () => {
      expect(calculateBlockHours(2)).toBe(2)
    })

    it('should calculate 4 hours for third block', () => {
      expect(calculateBlockHours(3)).toBe(4)
    })

    it('should calculate 8 hours for fourth block', () => {
      expect(calculateBlockHours(4)).toBe(8)
    })

    it('should calculate 16 hours for fifth block', () => {
      expect(calculateBlockHours(5)).toBe(16)
    })

    it('should follow correct escalation pattern: 1h -> 2h -> 4h -> 8h -> 16h', () => {
      expect(calculateBlockHours(1)).toBe(1)
      expect(calculateBlockHours(2)).toBe(2)
      expect(calculateBlockHours(3)).toBe(4)
      expect(calculateBlockHours(4)).toBe(8)
      expect(calculateBlockHours(5)).toBe(16)
    })
  })

  describe('Time Display Logic', () => {
    const formatRemainingTime = (remainingMs: number): string => {
      const remainingMins = Math.ceil(remainingMs / (60 * 1000))
      const remainingHours = Math.floor(remainingMins / 60)
      const mins = remainingMins % 60

      if (remainingHours > 0) {
        return mins > 0 
          ? `${remainingHours}h ${mins}m` 
          : `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`
      }
      return `${remainingMins} minute${remainingMins > 1 ? 's' : ''}`
    }

    it('should format 1 hour correctly', () => {
      expect(formatRemainingTime(60 * 60 * 1000)).toBe('1 hour')
    })

    it('should format 2 hours correctly', () => {
      expect(formatRemainingTime(2 * 60 * 60 * 1000)).toBe('2 hours')
    })

    it('should format 1h 30m correctly', () => {
      expect(formatRemainingTime(90 * 60 * 1000)).toBe('1h 30m')
    })

    it('should format 15 minutes correctly', () => {
      expect(formatRemainingTime(15 * 60 * 1000)).toBe('15 minutes')
    })

    it('should format 1 minute correctly', () => {
      expect(formatRemainingTime(60 * 1000)).toBe('1 minute')
    })
  })

  describe('Failure Counting Logic', () => {
    interface BlockRecord {
      failedAttempts: number
      totalFailures: number
      blockCount: number
      blockUntil: Date | null
    }

    const simulateFailure = (record: BlockRecord): BlockRecord => {
      const now = new Date()
      
      // If block has expired, reset failedAttempts and clear the expired block
      if (record.blockUntil && record.blockUntil <= now) {
        record.failedAttempts = 0
        record.blockUntil = null // Clear expired block so we don't keep resetting
      }

      // Increment counters
      record.failedAttempts += 1
      record.totalFailures += 1

      // Check if we hit 3 failures - time to block
      if (record.failedAttempts >= 3) {
        record.blockCount += 1
        record.failedAttempts = 0
        
        const blockHours = Math.pow(2, record.blockCount - 1)
        record.blockUntil = new Date(now.getTime() + blockHours * 60 * 60 * 1000)
      }

      return record
    }

    it('should increment failedAttempts on each failure', () => {
      let record: BlockRecord = { failedAttempts: 0, totalFailures: 0, blockCount: 0, blockUntil: null }
      
      record = simulateFailure(record)
      expect(record.failedAttempts).toBe(1)
      expect(record.totalFailures).toBe(1)
      
      record = simulateFailure(record)
      expect(record.failedAttempts).toBe(2)
      expect(record.totalFailures).toBe(2)
    })

    it('should trigger block after 3 failures', () => {
      let record: BlockRecord = { failedAttempts: 0, totalFailures: 0, blockCount: 0, blockUntil: null }
      
      record = simulateFailure(record) // 1
      record = simulateFailure(record) // 2
      record = simulateFailure(record) // 3 -> block
      
      expect(record.blockCount).toBe(1)
      expect(record.failedAttempts).toBe(0) // Reset after block
      expect(record.blockUntil).not.toBeNull()
    })

    it('should trigger 1-hour block on first block cycle', () => {
      let record: BlockRecord = { failedAttempts: 2, totalFailures: 2, blockCount: 0, blockUntil: null }
      const beforeBlock = Date.now()
      
      record = simulateFailure(record)
      
      expect(record.blockCount).toBe(1)
      const blockDuration = record.blockUntil!.getTime() - beforeBlock
      expect(blockDuration).toBeGreaterThanOrEqual(60 * 60 * 1000) // >= 1 hour
      expect(blockDuration).toBeLessThan(61 * 60 * 1000) // < 1h 1m
    })

    it('should reset failedAttempts when block expires', () => {
      let record: BlockRecord = { 
        failedAttempts: 2, 
        totalFailures: 5, 
        blockCount: 1, 
        blockUntil: new Date(Date.now() - 1000) // Expired
      }
      
      record = simulateFailure(record)
      
      // failedAttempts was reset to 0, then +1
      expect(record.failedAttempts).toBe(1)
      expect(record.totalFailures).toBe(6)
    })

    it('should double block duration on second block', () => {
      let record: BlockRecord = { 
        failedAttempts: 2, 
        totalFailures: 5, 
        blockCount: 1, 
        blockUntil: new Date(Date.now() - 1000) // Expired
      }
      const beforeBlock = Date.now()
      
      // 3 failures after block expired
      record = simulateFailure(record) // 1
      record = simulateFailure(record) // 2  
      record = simulateFailure(record) // 3 -> second block
      
      expect(record.blockCount).toBe(2)
      const blockDuration = record.blockUntil!.getTime() - beforeBlock
      expect(blockDuration).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000) // >= 2 hours
      expect(blockDuration).toBeLessThan(2.1 * 60 * 60 * 1000)
    })

    it('should accumulate total failures across multiple blocks', () => {
      let record: BlockRecord = { failedAttempts: 0, totalFailures: 0, blockCount: 0, blockUntil: null }
      
      // First 3 failures
      record = simulateFailure(record)
      record = simulateFailure(record)
      record = simulateFailure(record)
      expect(record.totalFailures).toBe(3)
      expect(record.blockCount).toBe(1)
      
      // Simulate block expiry
      record.blockUntil = new Date(Date.now() - 1000)
      
      // Next 3 failures  
      record = simulateFailure(record)
      record = simulateFailure(record)
      record = simulateFailure(record)
      expect(record.totalFailures).toBe(6)
      expect(record.blockCount).toBe(2)
    })
  })

  describe('Block Check Logic', () => {
    const isBlocked = (blockUntil: Date | null): boolean => {
      if (!blockUntil) return false
      return blockUntil > new Date()
    }

    it('should return false when blockUntil is null', () => {
      expect(isBlocked(null)).toBe(false)
    })

    it('should return false when block has expired', () => {
      const expiredDate = new Date(Date.now() - 1000)
      expect(isBlocked(expiredDate)).toBe(false)
    })

    it('should return true when block is active', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000)
      expect(isBlocked(futureDate)).toBe(true)
    })
  })
})

describe('TooManyRequestsError', () => {
  it('should be throwable with custom message', () => {
    const error = new TooManyRequestsError('Custom rate limit message')
    expect(error.message).toBe('Custom rate limit message')
    expect(error).toBeInstanceOf(Error)
  })

  it('should have default message', () => {
    const error = new TooManyRequestsError()
    expect(error.message).toBeTruthy()
  })
})

describe('OTP Block Model Interface', () => {
  interface IOtpBlock {
    phone: string
    failedAttempts: number
    totalFailures: number
    blockCount: number
    blockUntil: Date | null
    lastFailureAt: Date | null
  }

  it('should have all required fields', () => {
    const record: IOtpBlock = {
      phone: '+27821234567',
      failedAttempts: 2,
      totalFailures: 5,
      blockCount: 1,
      blockUntil: new Date(),
      lastFailureAt: new Date(),
    }

    expect(record.phone).toBe('+27821234567')
    expect(record.failedAttempts).toBe(2)
    expect(record.totalFailures).toBe(5)
    expect(record.blockCount).toBe(1)
    expect(record.blockUntil).toBeInstanceOf(Date)
    expect(record.lastFailureAt).toBeInstanceOf(Date)
  })

  it('should allow null for blockUntil and lastFailureAt', () => {
    const record: IOtpBlock = {
      phone: '+27821234567',
      failedAttempts: 0,
      totalFailures: 0,
      blockCount: 0,
      blockUntil: null,
      lastFailureAt: null,
    }

    expect(record.blockUntil).toBeNull()
    expect(record.lastFailureAt).toBeNull()
  })
})
