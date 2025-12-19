import { GET } from '@/app/api/admin/cron-status/route';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import CronRun from '@/models/CronRun';

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(),
}));

jest.mock('@/models/CronRun', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

const mockRequireSession = requireSession as jest.Mock;
const mockConnect = connect as jest.Mock;

describe('GET /api/admin/cron-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'user' });

    const request = new Request('http://localhost:3000/api/admin/cron-status', {
      method: 'GET',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain('Forbidden');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns tracked jobs in a stable order (defaulting missing docs)', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'admin' });
    mockConnect.mockResolvedValue({});

    const now = new Date('2025-01-01T10:00:00.000Z');

    (CronRun.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          job: 'match-requests',
          status: 'success',
          lastRunAt: now,
          lastSuccessAt: now,
          lastErrorAt: null,
          message: 'Processed 10',
          durationMs: 1234,
          updatedAt: now,
        },
      ]),
    });

    const request = new Request('http://localhost:3000/api/admin/cron-status', {
      method: 'GET',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    expect(json.data).toHaveLength(2);
    expect(json.data[0].job).toBe('match-requests');
    expect(json.data[0].status).toBe('success');
    expect(json.data[0].lastRunAt).toBe(now.toISOString());

    expect(json.data[1].job).toBe('cleanup-sold-cars');
    expect(json.data[1].status).toBe('idle');
    expect(json.data[1].lastRunAt).toBe(null);
  });
});
