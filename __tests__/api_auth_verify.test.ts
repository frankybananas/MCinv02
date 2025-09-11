import { POST as verifyOtp } from '@/app/api/auth/otp/verify/route';

jest.mock('@/lib/mongodb', () => ({ connect: jest.fn(async () => {}) }));
jest.mock('@/models/User', () => ({ __esModule: true, default: { findOne: jest.fn(async () => ({ _id: 'u1', phone: '+10000000000', role: 'user' })) }}));
jest.mock('@/models/Session', () => ({ __esModule: true, default: { find: jest.fn(async () => ([])), findByIdAndUpdate: jest.fn(async () => ({})) } }));
jest.mock('twilio', () => ({ Twilio: jest.fn().mockImplementation(() => ({ verify: { v2: { services: () => ({ verificationChecks: { create: jest.fn(async ({ code }) => ({ status: code === '123456' ? 'approved' : 'pending' })) } }) } } })) }));

const setEnv = (vars: Record<string, string | undefined>) => { Object.assign(process.env, vars); };

const makeReq = (body: any) => new Request('http://localhost/api/auth/otp/verify', { method: 'POST', headers: { 'user-agent': 'jest' }, body: JSON.stringify(body) });

describe('API /api/auth/otp/verify', () => {
  beforeEach(() => { jest.resetModules(); });

  it('fails when env is missing', async () => {
    setEnv({ JWT_SECRET: '', TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_VERIFY_SERVICE_SID: '' });
    const res = await verifyOtp(makeReq({ phone: '+10000000000', code: '123456' }) as any);
    expect(res.status).toBe(500);
  });

  it('returns error for invalid code', async () => {
    setEnv({ JWT_SECRET: 'secret', TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 'token', TWILIO_VERIFY_SERVICE_SID: 'VS' });
    const res = await verifyOtp(makeReq({ phone: '+10000000000', code: '000000' }) as any);
    const json = await (res as any).json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('approves correct code and returns success', async () => {
    setEnv({ JWT_SECRET: 'secret', TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 'token', TWILIO_VERIFY_SERVICE_SID: 'VS' });
    const res = await verifyOtp(makeReq({ phone: '+10000000000', code: '123456' }) as any);
    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
