let now = new Date('2025-01-01T00:00:00.000Z');

let consoleLogSpy: jest.SpyInstance | null = null;

type RateLimitRecord = { key: string; count: number; expiresAt: Date };

type OtpBlockRecord = {
  phone: string;
  failedAttempts: number;
  totalFailures: number;
  blockCount: number;
  blockUntil: Date | null;
  lastFailureAt: Date | null;
  save: jest.Mock;
};

const rateLimitStore = new Map<string, RateLimitRecord>();
const otpBlockStore = new Map<string, OtpBlockRecord>();

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({})),
}));

jest.mock('@/models/RateLimit', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(async (query: any, update: any) => {
      const key = String(query.key);
      const existing = rateLimitStore.get(key);

      if (!existing) {
        const expiresAt = update?.$setOnInsert?.expiresAt instanceof Date
          ? update.$setOnInsert.expiresAt
          : new Date();
        const record: RateLimitRecord = { key, count: 1, expiresAt };
        rateLimitStore.set(key, record);
        return record;
      }

      const inc = typeof update?.$inc?.count === 'number' ? update.$inc.count : 0;
      existing.count += inc;
      return existing;
    }),
  },
}));

jest.mock('@/models/OtpBlock', () => {
  const MockOtpBlockConstructor: any = function (this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async () => {
      otpBlockStore.set(this.phone, this);
      return this;
    });
  };

  MockOtpBlockConstructor.findOne = jest.fn(async (query: any) => {
    return otpBlockStore.get(String(query.phone)) || null;
  });

  MockOtpBlockConstructor.deleteOne = jest.fn(async (query: any) => {
    const existed = otpBlockStore.delete(String(query.phone));
    return { deletedCount: existed ? 1 : 0 };
  });

  return {
    __esModule: true,
    default: MockOtpBlockConstructor,
  };
});

import { TooManyRequestsError } from '@/lib/errors';
import { checkOtpBlock, checkOtpRateLimit, recordOtpFailure, resetOtpBlock } from '@/lib/rate-limit';

describe('OTP Rate Limiting + Progressive Blocking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitStore.clear();
    otpBlockStore.clear();

    jest.useFakeTimers();
    now = new Date('2025-01-01T00:00:00.000Z');
    jest.setSystemTime(now);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy?.mockRestore();
    consoleLogSpy = null;
  });

  describe('checkOtpRateLimit (OTP send)', () => {
    it('should allow up to 5 sends per hour and block on the 6th', async () => {
      const phone = '+27821234567';

      for (let i = 0; i < 5; i++) {
        await expect(checkOtpRateLimit(phone, 'send')).resolves.toBeUndefined();
      }

      await expect(checkOtpRateLimit(phone, 'send')).rejects.toBeInstanceOf(TooManyRequestsError);
      await expect(checkOtpRateLimit(phone, 'send')).rejects.toThrow('Max 5 OTP send attempts per hour');
    });

    it('should reset bucket counts when the hour bucket changes', async () => {
      const phone = '+27821234567';

      for (let i = 0; i < 5; i++) {
        await expect(checkOtpRateLimit(phone, 'send')).resolves.toBeUndefined();
      }

      jest.advanceTimersByTime(60 * 60 * 1000);

      await expect(checkOtpRateLimit(phone, 'send')).resolves.toBeUndefined();
    });
  });

  describe('checkOtpBlock/recordOtpFailure/resetOtpBlock (OTP verify)', () => {
    it('should block after 3 failures and allow again after 1 hour cooldown', async () => {
      const phone = '+27821234567';

      await recordOtpFailure(phone);
      await recordOtpFailure(phone);
      await recordOtpFailure(phone);

      const record = otpBlockStore.get(phone);
      expect(record?.blockCount).toBe(1);
      expect(record?.failedAttempts).toBe(0);
      expect(record?.blockUntil).toBeInstanceOf(Date);

      await expect(checkOtpBlock(phone)).rejects.toBeInstanceOf(TooManyRequestsError);
      await expect(checkOtpBlock(phone)).rejects.toThrow('Please try again in 1 hour');

      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      await expect(checkOtpBlock(phone)).resolves.toBeUndefined();
    });

    it('should escalate blocks (1h then 2h) across cycles of 3 failures', async () => {
      const phone = '+27821234567';

      await recordOtpFailure(phone);
      await recordOtpFailure(phone);
      await recordOtpFailure(phone);

      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      await recordOtpFailure(phone);
      await recordOtpFailure(phone);
      await recordOtpFailure(phone);

      const record = otpBlockStore.get(phone);
      expect(record?.blockCount).toBe(2);
      expect(record?.blockUntil).toBeInstanceOf(Date);

      await expect(checkOtpBlock(phone)).rejects.toBeInstanceOf(TooManyRequestsError);
      await expect(checkOtpBlock(phone)).rejects.toThrow('Please try again in 2 hours');
    });

    it('should reset block record on successful login', async () => {
      const phone = '+27821234567';

      await recordOtpFailure(phone);
      await recordOtpFailure(phone);
      await recordOtpFailure(phone);

      expect(otpBlockStore.has(phone)).toBe(true);

      await resetOtpBlock(phone);

      expect(otpBlockStore.has(phone)).toBe(false);
      await expect(checkOtpBlock(phone)).resolves.toBeUndefined();
    });
  });
});
