import { POST as sendOtp } from '@/app/api/auth/otp/send/route';

jest.mock('@/lib/mongodb', () => ({ connect: jest.fn(async () => {}) }));
jest.mock('@/models/User', () => ({ __esModule: true, default: { findOne: jest.fn(async () => ({ _id: 'u1', phone: '+10000000000', role: 'user' })) }}));
jest.mock('@/lib/test-accounts', () => ({ getTestOtp: jest.fn(() => null), createTestUser: jest.fn(async () => {}) }));
jest.mock('twilio', () => ({ Twilio: jest.fn().mockImplementation(() => ({ verify: { v2: { services: () => ({ verifications: { create: jest.fn(async () => ({ sid: 'verif' })) } }) } } })) }));

const setEnv = (vars: Record<string, string | undefined>) => {
  Object.assign(process.env, vars);
};

describe('API /api/auth/otp/send', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 500 when Verify env is missing', async () => {
    setEnv({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_VERIFY_SERVICE_SID: '' });
    const req = new Request('http://localhost/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone: '+10000000000' }) });
    const res = await sendOtp(req as any);
    const json = await (res as any).json();
    expect(res.status).toBe(500);
    expect(json.error).toBeDefined();
  });

  it('succeeds with proper env and authorized user', async () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 'token', TWILIO_VERIFY_SERVICE_SID: 'VS' });
    const req = new Request('http://localhost/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone: '+10000000000' }) });
    const res = await sendOtp(req as any);
    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
