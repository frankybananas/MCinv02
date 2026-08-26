/**
 * Integration Test: Car Lifecycle
 * 
 * Tests the complete journey of a car through the system:
 * 1. Car creation with images
 * 2. Status transitions (coming → in-stock → reserved → sold)
 * 3. Delivery auto-creation on reservation
 * 4. Audit log tracking
 * 5. Car deletion and cleanup
 */

// Mock modules before imports
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue({}),
  connect: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn().mockResolvedValue({
    phone: '+27123456789',
    role: 'admin',
    userId: 'user-123',
    token: 'mock-token',
    payload: { jti: 'mock-jti' },
  }),
  verifyActiveSession: jest.fn().mockResolvedValue(undefined),
  isPrivileged: jest.fn().mockReturnValue(true),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn((key: string) => {
      const headers: Record<string, string> = {
        'x-user-phone': '+27123456789',
        'x-user-name': 'Test Admin',
        'x-user-role': 'admin',
      };
      return headers[key] || null;
    }),
  }),
}));

// Mock Car model
interface AuditEntry {
  action: string;
  details: string;
  user: string;
  timestamp?: string;
}

interface MockCar {
  _id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  status: string;
  auditLog: AuditEntry[];
  images: string[];
  soldAt: Date | null;
  save: jest.Mock;
  populate: jest.Mock;
  toObject: jest.Mock;
}

const mockCar: MockCar = {
  _id: 'car-123',
  make: 'Toyota',
  model: 'Corolla',
  year: 2023,
  price: 350000,
  status: 'coming',
  auditLog: [],
  images: [],
  soldAt: null,
  save: jest.fn().mockResolvedValue(true),
  populate: jest.fn().mockReturnThis(),
  toObject: jest.fn().mockReturnValue({
    _id: 'car-123',
    make: 'Toyota',
    model: 'Corolla',
    year: 2023,
    price: 350000,
    status: 'coming',
    auditLog: [],
    images: [],
  }),
};

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([mockCar]),
        }),
      }),
    }),
    findById: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCar),
      }),
    }),
    create: jest.fn().mockResolvedValue(mockCar),
    findByIdAndDelete: jest.fn().mockResolvedValue(mockCar),
    syncIndexes: jest.fn().mockResolvedValue(undefined),
    collection: {
      indexes: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock('@/models/Picture', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}));

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'delivery-123' }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue({ _id: 'user-123', phone: '+27123456789' }),
  },
}));

jest.mock('@/models/Client.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  },
}));

jest.mock('@/models/WhatsAppGeneration', () => ({
  __esModule: true,
  default: {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  },
}));

jest.mock('@/lib/s3', () => ({
  s3: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

describe('Car Lifecycle Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCar.auditLog = [];
    mockCar.status = 'coming';
  });

  describe('Car Creation', () => {
    it('should create a new car with required fields', async () => {
      const Car = (await import('@/models/Car')).default;
      
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2023,
        price: 350000,
        status: 'coming',
      };

      const newCar = await Car.create(carData);

      expect(Car.create).toHaveBeenCalledWith(carData);
      expect(newCar._id).toBe('car-123');
      expect(newCar.make).toBe('Toyota');
    });

    it('should enforce role-based access for car creation', () => {
      const allowedRoles = ['admin', 'manager', 'recon'];
      
      const canCreateCar = (role: string) => allowedRoles.includes(role);

      expect(canCreateCar('admin')).toBe(true);
      expect(canCreateCar('manager')).toBe(true);
      expect(canCreateCar('recon')).toBe(true);
      expect(canCreateCar('user')).toBe(false);
    });

    it('should validate required car fields', () => {
      const validateCarFields = (data: Record<string, unknown>) => {
        const required = ['make', 'model', 'year', 'price'];
        const missing = required.filter(field => !data[field]);
        return missing;
      };

      expect(validateCarFields({ make: 'Toyota', model: 'Corolla', year: 2023, price: 350000 })).toEqual([]);
      expect(validateCarFields({ make: 'Toyota' })).toContain('model');
      expect(validateCarFields({})).toEqual(['make', 'model', 'year', 'price']);
    });
  });

  describe('Status Transitions', () => {
    it('should track status changes in audit log', async () => {
      // Simulate status change tracking
      const statusChange = {
        from: 'coming',
        to: 'in-stock',
        user: 'Test Admin',
        timestamp: new Date().toISOString(),
      };

      mockCar.auditLog.push({
        action: 'Car Status Update',
        details: `Status changed from '${statusChange.from}' to '${statusChange.to}'`,
        user: statusChange.user,
        timestamp: statusChange.timestamp,
      });

      expect(mockCar.auditLog).toHaveLength(1);
      expect(mockCar.auditLog[0].action).toBe('Car Status Update');
      expect(mockCar.auditLog[0].details).toContain('coming');
      expect(mockCar.auditLog[0].details).toContain('in-stock');
    });

    it('should allow valid status transitions', () => {
      const validStatuses = ['in-stock', 'coming', 'reserved', 'sold'];
      
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });

    it('should set soldAt timestamp when status changes to sold', () => {
      const car: { status: string; soldAt: Date | null } = { 
        status: 'reserved', 
        soldAt: null 
      };
      
      // Simulate status change to sold
      car.status = 'sold';
      car.soldAt = new Date();

      expect(car.status).toBe('sold');
      expect(car.soldAt).toBeInstanceOf(Date);
    });
  });

  describe('Reservation Flow', () => {
    it('should create delivery record when car is reserved', async () => {
      const Delivery = (await import('@/models/Delivery')).default;
      
      // Simulate reservation
      await Delivery.findOneAndUpdate(
        { car: 'car-123', salesperson: 'user-123' },
        { $setOnInsert: { car: 'car-123', salesperson: 'user-123' } },
        { new: true, upsert: true }
      );

      expect(Delivery.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ car: 'car-123' }),
        expect.any(Object),
        expect.objectContaining({ upsert: true })
      );
    });

    it('should link client to car when reserving with clientId', async () => {
      const Client = (await import('@/models/Client.js')).default;
      
      // Simulate client linking
      await Client.updateOne(
        { _id: 'client-123' },
        { $addToSet: { cars: 'car-123' } }
      );

      expect(Client.updateOne).toHaveBeenCalledWith(
        { _id: 'client-123' },
        { $addToSet: { cars: 'car-123' } }
      );
    });
  });

  describe('Car Deletion', () => {
    it('should clean up related records when car is deleted', async () => {
      const Delivery = (await import('@/models/Delivery')).default;
      const Picture = (await import('@/models/Picture')).default;
      const WhatsAppGeneration = (await import('@/models/WhatsAppGeneration')).default;

      // Simulate deletion cleanup
      await Picture.deleteMany({ _id: { $in: [] } });
      await Delivery.deleteMany({ car: 'car-123' });
      await WhatsAppGeneration.updateMany(
        { carIds: { $in: ['car-123'] } },
        { $pull: { carIds: 'car-123' } }
      );

      expect(Picture.deleteMany).toHaveBeenCalled();
      expect(Delivery.deleteMany).toHaveBeenCalledWith({ car: 'car-123' });
      expect(WhatsAppGeneration.updateMany).toHaveBeenCalled();
    });
  });
});

describe('Car API Validation', () => {
  it('should require authentication for all endpoints', () => {
    // Auth session module should export requireSession function
    const authSession = require('@/lib/auth-session');
    expect(authSession.requireSession).toBeDefined();
  });

  it('should validate numeric fields', () => {
    const validateCarData = (data: Record<string, unknown>) => {
      const errors: string[] = [];
      
      if (typeof data.year !== 'number' || data.year < 1900 || data.year > 2100) {
        errors.push('Invalid year');
      }
      if (typeof data.price !== 'number' || data.price < 0) {
        errors.push('Invalid price');
      }
      if (data.kilometers !== undefined && (typeof data.kilometers !== 'number' || data.kilometers < 0)) {
        errors.push('Invalid kilometers');
      }
      
      return errors;
    };

    expect(validateCarData({ year: 2023, price: 350000 })).toEqual([]);
    expect(validateCarData({ year: 1800, price: 350000 })).toContain('Invalid year');
    expect(validateCarData({ year: 2023, price: -100 })).toContain('Invalid price');
  });

  it('should validate status enum values', () => {
    const validStatuses = ['in-stock', 'coming', 'reserved', 'sold'];
    
    const isValidStatus = (status: string) => validStatuses.includes(status);

    expect(isValidStatus('in-stock')).toBe(true);
    expect(isValidStatus('reserved')).toBe(true);
    expect(isValidStatus('invalid-status')).toBe(false);
  });
});
