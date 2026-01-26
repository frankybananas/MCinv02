jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn().mockResolvedValue({
    phone: '+27123456789',
    role: 'admin',
    userId: 'user-1',
    payload: { jti: 'test-jti' },
  }),
  verifyActiveSession: jest.fn().mockResolvedValue(undefined),
  isPrivileged: jest.fn().mockReturnValue(true),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn(() => null),
  }),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@/lib/s3', () => ({
  s3: { send: jest.fn().mockResolvedValue({}) },
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('x')),
  })),
}));

let mockCar: any;

const CarMock = {
  syncIndexes: jest.fn().mockResolvedValue(undefined),
  collection: {
    indexes: jest.fn().mockResolvedValue([]),
    dropIndex: jest.fn().mockResolvedValue(undefined),
    createIndex: jest.fn().mockResolvedValue(undefined),
  },
  create: jest.fn(async () => mockCar),
  findById: jest.fn(async () => mockCar),
};

jest.mock('@/models/Car.js', () => ({
  __esModule: true,
  default: CarMock,
}));

const PictureMock = jest.fn(function (this: any, data: any) {
  Object.assign(this, data);
  this._id = 'pic-1';
  this.save = jest.fn().mockResolvedValue(this);
});
(PictureMock as any).deleteMany = jest.fn();

jest.mock('@/models/Picture', () => ({
  __esModule: true,
  default: PictureMock,
}));

import { POST } from '@/app/api/cars/route';
import { PUT } from '@/app/api/cars/[id]/route';

const makeFile = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

describe('Cars API image validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCar = {
      _id: 'car-1',
      make: 'Toyota',
      model: 'Corolla',
      year: 2024,
      auditLog: [],
      images: [],
      toObject: jest.fn(() => ({ images: [] })),
      save: jest.fn(),
      populate: jest.fn(),
    };
    mockCar.save.mockResolvedValue(mockCar);
    mockCar.populate.mockResolvedValue(mockCar);
    CarMock.create.mockResolvedValue(mockCar);
    CarMock.findById.mockResolvedValue(mockCar);
  });

  it('POST rejects unsupported image types', async () => {
    const form = new FormData();
    form.append('images', makeFile('bad.txt', 'text/plain'));
    form.append('make', 'Toyota');
    form.append('model', 'Corolla');
    form.append('year', '2024');
    form.append('price', '100000');

    const request = new Request('http://localhost:3000/api/cars', {
      method: 'POST',
      body: form,
    });

    const response = await POST(request as any);
    expect(response.status).toBe(415);
    const json = await response.json();
    expect(json.message).toMatch(/Unsupported image type/i);
    expect(CarMock.create).not.toHaveBeenCalled();
  });

  it('PUT attaches car id to new Picture uploads', async () => {
    const form = new FormData();
    form.append('images', makeFile('car.jpg', 'image/jpeg'));
    form.append('imageTitles', 'Front');

    const request = new Request('http://localhost:3000/api/cars/car-1', {
      method: 'PUT',
      body: form,
    });

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'car-1' }) });
    expect(response.status).toBe(200);
    expect(PictureMock).toHaveBeenCalled();
    const args = PictureMock.mock.calls[0][0];
    expect(args.car).toBe('car-1');
  });

  it('PUT rejects unsupported image types', async () => {
    const form = new FormData();
    form.append('images', makeFile('bad.txt', 'text/plain'));

    const request = new Request('http://localhost:3000/api/cars/car-1', {
      method: 'PUT',
      body: form,
    });

    const response = await PUT(request as any, { params: Promise.resolve({ id: 'car-1' }) });
    expect(response.status).toBe(415);
    const json = await response.json();
    expect(json.message).toMatch(/Unsupported image type/i);
    expect(PictureMock).not.toHaveBeenCalled();
  });
});
