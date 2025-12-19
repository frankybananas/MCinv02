import { GET } from '@/app/api/admin/system-metrics/route';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import Car from '@/models/Car';
import Client from '@/models/Client';
import Delivery from '@/models/Delivery';
import Picture from '@/models/Picture';

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(),
}));

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
  },
}));

jest.mock('@/models/Client', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/models/Picture', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
  },
}));

const mockRequireSession = requireSession as jest.Mock;
const mockConnect = connect as jest.Mock;

describe('GET /api/admin/system-metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'user' });

    const request = new Request('http://localhost:3000/api/admin/system-metrics', {
      method: 'GET',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain('Forbidden');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns aggregated metrics for admin', async () => {
    mockRequireSession.mockResolvedValue({ phone: '+27821234567', role: 'admin' });
    mockConnect.mockResolvedValue({});

    (Car.aggregate as jest.Mock).mockResolvedValue([
      { _id: 'in-stock', count: 2 },
      { _id: 'sold', count: 1 },
    ]);

    (Client.countDocuments as jest.Mock).mockResolvedValue(5);
    (Delivery.countDocuments as jest.Mock).mockResolvedValue(3);

    (Picture.aggregate as jest.Mock).mockResolvedValue([
      { _id: null, count: 10, totalBytes: 5 * 1024 * 1024 },
    ]);

    const request = new Request('http://localhost:3000/api/admin/system-metrics', {
      method: 'GET',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    expect(json.cars.total).toBe(3);
    expect(json.cars.byStatus['in-stock']).toBe(2);
    expect(json.cars.byStatus.coming).toBe(0);
    expect(json.cars.byStatus.reserved).toBe(0);
    expect(json.cars.byStatus.sold).toBe(1);

    expect(json.clients.total).toBe(5);
    expect(json.deliveries.total).toBe(3);

    expect(json.images.total).toBe(10);
    expect(json.images.totalSizeBytes).toBe(5 * 1024 * 1024);
    expect(json.images.totalSizeMB).toBe(5);
  });
});
