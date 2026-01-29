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

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    Types: {
      ObjectId: {
        isValid: jest.fn(() => true),
      },
    },
  },
  Types: {
    ObjectId: {
      isValid: jest.fn(() => true),
    },
  },
}));

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/models/Client.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/models/WhatsAppGeneration', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn().mockResolvedValue({}),
  },
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

jest.mock('@/models/Car.js', () => ({
  __esModule: true,
  default: {
    syncIndexes: jest.fn().mockResolvedValue(undefined),
    collection: {
      indexes: jest.fn().mockResolvedValue([]),
      dropIndex: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue(undefined),
    },
    create: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('@/models/Picture', () => {
  const PictureMock = jest.fn(function (this: any, data: any) {
    Object.assign(this, data);
    this._id = 'pic-1';
    this.save = jest.fn().mockResolvedValue(this);
  });
  (PictureMock as any).deleteMany = jest.fn();

  return {
    __esModule: true,
    default: PictureMock,
  };
});

import Car from '@/models/Car.js';
import Picture from '@/models/Picture';
import { POST } from '@/app/api/cars/route';
import { PUT } from '@/app/api/cars/[id]/route';

const CarMock = Car as unknown as {
  syncIndexes: jest.Mock;
  collection: {
    indexes: jest.Mock;
    dropIndex: jest.Mock;
    createIndex: jest.Mock;
  };
  create: jest.Mock;
  findById: jest.Mock;
};

const PictureMock = Picture as unknown as jest.Mock & { deleteMany?: jest.Mock };

const makeFile = (name: string, type: string) => {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  return Object.assign(file, {
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
};
const makeMultipartRequest = (url: string, form: FormData) =>
  ({
    headers: new Headers({ 'content-type': 'multipart/form-data; boundary=----test' }),
    formData: async () => form,
    url,
  }) as any;

describe('Cars API image validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://r2.example.com';
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

    const response = await POST(makeMultipartRequest('http://localhost:3000/api/cars', form));
    expect(response.status).toBe(415);
    const json = await response.json();
    expect(json.message).toMatch(/Unsupported image type/i);
    expect(CarMock.create).not.toHaveBeenCalled();
  });

  it('PUT attaches car id to new Picture uploads', async () => {
    const form = new FormData();
    form.append('images', makeFile('car.jpg', 'image/jpeg'));
    form.append('imageTitles', 'Front');

    const response = await PUT(
      makeMultipartRequest('http://localhost:3000/api/cars/car-1', form),
      { params: Promise.resolve({ id: 'car-1' }) }
    );
    expect(response.status).toBe(200);
    expect(PictureMock).toHaveBeenCalled();
    const args = PictureMock.mock.calls[0][0];
    expect(args.car).toBe('car-1');
  });

  it('PUT rejects unsupported image types', async () => {
    const form = new FormData();
    form.append('images', makeFile('bad.txt', 'text/plain'));

    const response = await PUT(
      makeMultipartRequest('http://localhost:3000/api/cars/car-1', form),
      { params: Promise.resolve({ id: 'car-1' }) }
    );
    expect(response.status).toBe(415);
    const json = await response.json();
    expect(json.message).toMatch(/Unsupported image type/i);
    expect(PictureMock).not.toHaveBeenCalled();
  });
});
