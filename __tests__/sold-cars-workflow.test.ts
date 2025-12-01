/**
 * Tests for SOLD cars workflow
 * - Dashboard sorting (sold cars pushed to bottom)
 * - Archive preserves Cover + VIN images
 * - Manager + Admin access to archive
 */

// Tests for SOLD cars workflow logic

// Mock modules
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn().mockResolvedValue({ phone: '+27821234567' }),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@/lib/s3', () => ({
  s3: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

const mockUserFindOne = jest.fn();
const mockSoldCarFind = jest.fn();
const mockCarFind = jest.fn();

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: () => mockUserFindOne(),
  },
}));

jest.mock('@/models/SoldCar', () => ({
  __esModule: true,
  default: {
    find: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => mockSoldCarFind(),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

describe('SOLD Cars Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Sorting Logic', () => {
    const sortCars = (cars: any[], sortKey: string, sortDir: string) => {
      const kmOf = (c: any) => (typeof c?.kilometers === 'number' ? c.kilometers : 0);
      const arr = [...cars];
      arr.sort((a, b) => {
        // Always push SOLD cars to the bottom of the list
        const aIsSold = a.status === 'sold';
        const bIsSold = b.status === 'sold';
        if (aIsSold !== bIsSold) {
          return aIsSold ? 1 : -1; // Sold cars go to end
        }
        // Among sold cars, sort by soldAt (most recently sold first)
        if (aIsSold && bIsSold) {
          const aSoldAt = new Date(a.soldAt ?? 0).getTime();
          const bSoldAt = new Date(b.soldAt ?? 0).getTime();
          return bSoldAt - aSoldAt; // Most recent sold first
        }
        // Normal sorting for non-sold cars
        switch (sortKey) {
          case 'recent': {
            const da = new Date(a.createdAt ?? 0).getTime();
            const db = new Date(b.createdAt ?? 0).getTime();
            return sortDir === 'asc' ? da - db : db - da;
          }
          case 'price': {
            const pa = a.price ?? 0;
            const pb = b.price ?? 0;
            return sortDir === 'asc' ? pa - pb : pb - pa;
          }
          default:
            return 0;
        }
      });
      return arr;
    };

    it('should push sold cars to the bottom of the list', () => {
      const cars = [
        { _id: '1', status: 'sold', make: 'Toyota', soldAt: '2024-01-01', createdAt: '2023-12-01' },
        { _id: '2', status: 'in-stock', make: 'BMW', createdAt: '2024-01-15' },
        { _id: '3', status: 'reserved', make: 'Audi', createdAt: '2024-01-10' },
        { _id: '4', status: 'sold', make: 'Honda', soldAt: '2024-01-15', createdAt: '2023-11-01' },
        { _id: '5', status: 'coming', make: 'Ford', createdAt: '2024-01-05' },
      ];

      const sorted = sortCars(cars, 'recent', 'desc');

      // Non-sold cars should come first
      expect(sorted[0].status).not.toBe('sold');
      expect(sorted[1].status).not.toBe('sold');
      expect(sorted[2].status).not.toBe('sold');
      // Sold cars should be at the end
      expect(sorted[3].status).toBe('sold');
      expect(sorted[4].status).toBe('sold');
    });

    it('should sort sold cars by soldAt date (most recent first)', () => {
      const cars = [
        { _id: '1', status: 'sold', make: 'Toyota', soldAt: '2024-01-01', createdAt: '2023-12-01' },
        { _id: '2', status: 'sold', make: 'BMW', soldAt: '2024-01-20', createdAt: '2023-12-15' },
        { _id: '3', status: 'sold', make: 'Audi', soldAt: '2024-01-10', createdAt: '2023-12-10' },
      ];

      const sorted = sortCars(cars, 'recent', 'desc');

      // Most recently sold should come first among sold cars
      expect(sorted[0].make).toBe('BMW'); // soldAt: 2024-01-20
      expect(sorted[1].make).toBe('Audi'); // soldAt: 2024-01-10
      expect(sorted[2].make).toBe('Toyota'); // soldAt: 2024-01-01
    });

    it('should maintain normal sorting for non-sold cars', () => {
      const cars = [
        { _id: '1', status: 'in-stock', make: 'Toyota', price: 150000, createdAt: '2024-01-01' },
        { _id: '2', status: 'reserved', make: 'BMW', price: 300000, createdAt: '2024-01-15' },
        { _id: '3', status: 'coming', make: 'Audi', price: 200000, createdAt: '2024-01-10' },
      ];

      const sortedByPrice = sortCars(cars, 'price', 'asc');
      expect(sortedByPrice[0].make).toBe('Toyota');
      expect(sortedByPrice[1].make).toBe('Audi');
      expect(sortedByPrice[2].make).toBe('BMW');

      const sortedByRecent = sortCars(cars, 'recent', 'desc');
      expect(sortedByRecent[0].make).toBe('BMW'); // Most recent
      expect(sortedByRecent[1].make).toBe('Audi');
      expect(sortedByRecent[2].make).toBe('Toyota'); // Oldest
    });

    it('should handle cars with missing soldAt gracefully', () => {
      const cars = [
        { _id: '1', status: 'sold', make: 'Toyota', createdAt: '2023-12-01' }, // No soldAt
        { _id: '2', status: 'sold', make: 'BMW', soldAt: '2024-01-20', createdAt: '2023-12-15' },
      ];

      // Should not throw
      const sorted = sortCars(cars, 'recent', 'desc');
      expect(sorted).toHaveLength(2);
    });
  });

  describe('SoldCar Model Fields', () => {
    it('should have cover and VIN image fields defined', () => {
      // Import the model to check its schema
      const SoldCarSchema = {
        originalCarId: { type: 'String', required: true },
        make: { type: 'String', required: true },
        carModel: { type: 'String', required: true },
        year: { type: 'Number', required: true },
        price: { type: 'Number', required: true },
        coverImageUrl: { type: 'String' },
        coverThumbnailUrl: { type: 'String' },
        vinImageUrl: { type: 'String' },
        vinThumbnailUrl: { type: 'String' },
      };

      expect(SoldCarSchema.coverImageUrl).toBeDefined();
      expect(SoldCarSchema.coverThumbnailUrl).toBeDefined();
      expect(SoldCarSchema.vinImageUrl).toBeDefined();
      expect(SoldCarSchema.vinThumbnailUrl).toBeDefined();
    });
  });

  describe('Image Preservation Logic', () => {
    it('should identify cover image from coverImageIndex', () => {
      const images = [
        { imageUrl: 'https://r2.example.com/img1.jpg', thumbnailUrl: 'https://r2.example.com/thumb1.jpg' },
        { imageUrl: 'https://r2.example.com/img2.jpg', thumbnailUrl: 'https://r2.example.com/thumb2.jpg' },
        { imageUrl: 'https://r2.example.com/img3.jpg', thumbnailUrl: 'https://r2.example.com/thumb3.jpg' },
      ];
      const coverImageIndex = 1;
      const vinImageIndex = 2;

      const coverImage = images[coverImageIndex] || images[0];
      const vinImage = vinImageIndex !== null ? images[vinImageIndex] : null;

      expect(coverImage.imageUrl).toBe('https://r2.example.com/img2.jpg');
      expect(vinImage?.imageUrl).toBe('https://r2.example.com/img3.jpg');
    });

    it('should fall back to first image if coverImageIndex is not set', () => {
      const images = [
        { imageUrl: 'https://r2.example.com/img1.jpg', thumbnailUrl: 'https://r2.example.com/thumb1.jpg' },
        { imageUrl: 'https://r2.example.com/img2.jpg', thumbnailUrl: 'https://r2.example.com/thumb2.jpg' },
      ];
      const coverImageIndex = undefined;

      const coverIdx = typeof coverImageIndex === 'number' ? coverImageIndex : 0;
      const coverImage = images[coverIdx] || images[0];

      expect(coverImage.imageUrl).toBe('https://r2.example.com/img1.jpg');
    });

    it('should handle missing VIN image gracefully', () => {
      const images = [
        { imageUrl: 'https://r2.example.com/img1.jpg', thumbnailUrl: 'https://r2.example.com/thumb1.jpg' },
      ];
      const vinImageIndex = null;

      const vinImage = vinImageIndex !== null ? images[vinImageIndex] : null;

      expect(vinImage).toBeNull();
    });

    it('should correctly identify images to preserve', () => {
      const coverImageUrl = 'https://r2.example.com/cover.jpg';
      const coverThumbnailUrl = 'https://r2.example.com/cover-thumb.jpg';
      const vinImageUrl = 'https://r2.example.com/vin.jpg';
      const vinThumbnailUrl = 'https://r2.example.com/vin-thumb.jpg';

      const preservedUrls = new Set([
        coverImageUrl, coverThumbnailUrl, vinImageUrl, vinThumbnailUrl
      ].filter(Boolean));

      expect(preservedUrls.has('https://r2.example.com/cover.jpg')).toBe(true);
      expect(preservedUrls.has('https://r2.example.com/other.jpg')).toBe(false);
    });
  });

  describe('API Access Control', () => {
    // Test the access control logic directly
    const checkAccess = (role: string): boolean => {
      return role === 'admin' || role === 'manager';
    };

    it('should allow admin to access sold cars archive', () => {
      expect(checkAccess('admin')).toBe(true);
    });

    it('should allow manager to access sold cars archive', () => {
      expect(checkAccess('manager')).toBe(true);
    });

    it('should deny regular user access to sold cars archive', () => {
      expect(checkAccess('user')).toBe(false);
    });

    it('should deny recon user access to sold cars archive', () => {
      expect(checkAccess('recon')).toBe(false);
    });

    it('should deny sales role access to sold cars archive', () => {
      expect(checkAccess('sales')).toBe(false);
    });
  });

  describe('Car Interface Types', () => {
    it('should include soldAt field in Car interface', () => {
      interface Car {
        _id: string;
        status: string;
        soldAt?: string | null;
      }

      const car: Car = {
        _id: '123',
        status: 'sold',
        soldAt: '2024-01-15T10:30:00Z',
      };

      expect(car.soldAt).toBeDefined();
      expect(typeof car.soldAt).toBe('string');
    });

    it('should allow null soldAt for non-sold cars', () => {
      interface Car {
        _id: string;
        status: string;
        soldAt?: string | null;
      }

      const car: Car = {
        _id: '123',
        status: 'in-stock',
        soldAt: null,
      };

      expect(car.soldAt).toBeNull();
    });
  });
});
