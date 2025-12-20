import { GET } from '@/app/api/admin/audit-log/route';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import { sanitizeForRegex } from '@/lib/validation';
import AuditLog from '@/models/AuditLog';

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(),
}));

jest.mock('@/models/AuditLog', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

const mockRequireSession = requireSession as jest.Mock;
const mockConnect = connect as jest.Mock;

describe('GET /api/admin/audit-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'user' });

    const request = new Request('http://localhost:3000/api/admin/audit-log', {
      method: 'GET',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain('Forbidden');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns paginated results and applies filters', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'admin' });
    mockConnect.mockResolvedValue({});

    const rows = [
      {
        _id: 'log1',
        eventType: 'LOGIN_FAIL',
        phone: '+27821234567',
        userId: 'user-1',
        ip: '1.2.3.4',
        userAgent: 'ua',
        metadata: { reason: 'Invalid OTP' },
        createdAt: new Date('2025-01-01T10:00:00.000Z'),
      },
    ];

    const findChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(rows),
    };

    (AuditLog.find as jest.Mock).mockReturnValue(findChain);
    (AuditLog.countDocuments as jest.Mock).mockResolvedValue(1);

    const request = new Request(
      'http://localhost:3000/api/admin/audit-log?page=1&limit=50&eventType=LOGIN_FAIL&q=%2B27',
      {
        method: 'GET',
      }
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.pagination.totalCount).toBe(1);

    const safe = sanitizeForRegex('+27');
    expect(AuditLog.find).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOGIN_FAIL',
        $or: expect.arrayContaining([
          expect.objectContaining({ phone: { $regex: safe, $options: 'i' } }),
        ]),
      })
    );

    expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(findChain.skip).toHaveBeenCalledWith(0);
    expect(findChain.limit).toHaveBeenCalledWith(50);
  });
});
