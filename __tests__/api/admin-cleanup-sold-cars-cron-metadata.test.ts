import { POST } from '@/app/api/admin/cleanup-sold-cars/route';
import { connect } from '@/lib/mongodb';
import { markCronError, markCronRunning, markCronSuccess } from '@/lib/cron-metadata';

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(),
}));

jest.mock('@/lib/cron-metadata', () => ({
  markCronRunning: jest.fn(),
  markCronSuccess: jest.fn(),
  markCronError: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@/models/SoldCar', () => ({
  __esModule: true,
  default: function SoldCarMock(this: any) {
    this.save = jest.fn().mockResolvedValue(this);
  },
}));

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({
      populate: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([]),
      })),
    })),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock('@/models/Picture', () => ({
  __esModule: true,
  default: {
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

const mockConnect = connect as jest.Mock;

describe('POST /api/admin/cleanup-sold-cars cron metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('records running + success on a successful (no-op) run', async () => {
    mockConnect.mockResolvedValue({});

    const request = new Request('http://localhost:3000/api/admin/cleanup-sold-cars', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-secret',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    expect(markCronRunning).toHaveBeenCalledWith('cleanup-sold-cars');
    expect(markCronSuccess).toHaveBeenCalledWith(
      'cleanup-sold-cars',
      expect.objectContaining({
        message: expect.any(String),
        durationMs: expect.any(Number),
      })
    );
    expect(markCronError).not.toHaveBeenCalled();
  });

  it('records error when the cleanup job throws', async () => {
    mockConnect.mockRejectedValue(new Error('db down'));

    const request = new Request('http://localhost:3000/api/admin/cleanup-sold-cars', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-secret',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBeDefined();

    expect(markCronRunning).not.toHaveBeenCalled();
    expect(markCronSuccess).not.toHaveBeenCalled();
    expect(markCronError).toHaveBeenCalledWith(
      'cleanup-sold-cars',
      expect.any(Error),
      expect.objectContaining({ durationMs: expect.any(Number) })
    );
  });
});
