import { GET, POST } from '@/app/api/admin/users/route';

// Mock session data
const mockSession = { phone: '+27123456789', role: 'admin', userId: 'admin-user-id', payload: { jti: 'test-jti' } };

jest.mock('@/lib/mongodb', () => ({ connect: jest.fn(async () => {}) }));
jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => mockSession),
  verifyActiveSession: jest.fn(async () => {}),
}));
jest.mock('@/models/User', () => ({ __esModule: true, default: {
  find: jest.fn(() => ({
    sort: jest.fn(async () => ([{ _id: 'u1', phone: '+100', profile: { firstName: 'A', lastName: 'B' }, department: 'new', role: 'user', createdAt: new Date().toISOString() }]))
  })),
  findOne: jest.fn(async () => null),
  create: jest.fn(async (u: any) => u),
}}));

// Import the mock to be able to change it per test
import { requireSession } from '@/lib/auth-session';
const mockRequireSession = requireSession as jest.Mock;

const makeReq = (method: string, body?: any, role: string = 'admin') => new Request('http://localhost/api/admin/users', {
  method,
  headers: { 'x-user-role': role },
  body: body ? JSON.stringify(body) : undefined,
});

describe('API /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to admin session by default
    mockRequireSession.mockResolvedValue({ phone: '+27123456789', role: 'admin', userId: 'admin-user-id', payload: { jti: 'test-jti' } });
  });

  it('forbids non-admin GET', async () => {
    // Mock non-admin session
    mockRequireSession.mockResolvedValue({ phone: '+27123456789', role: 'user', userId: 'user-id', payload: { jti: 'test-jti' } });
    const res = await GET(makeReq('GET', undefined, 'user') as any);
    expect(res.status).toBe(403);
  });

  it('lists users for admin', async () => {
    const res = await GET(makeReq('GET') as any);
    expect(res.status).toBe(200);
    const json = await (res as any).json();
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('rejects POST missing fields', async () => {
    const res = await POST(makeReq('POST', { phone: '+100' }) as any);
    expect(res.status).toBe(400);
  });
});
