// Mock the API routes
jest.mock('@/app/api/whatsapp/generate/route', () => ({
  POST: jest.fn(),
}));

jest.mock('@/app/api/whatsapp/complete/route', () => ({
  POST: jest.fn(),
}));

const { POST: generatePOST } = require('@/app/api/whatsapp/generate/route');
const { POST: completePOST } = require('@/app/api/whatsapp/complete/route');

// Mock the database connection
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(() => Promise.resolve())
}));

// Mock the auth session
const userId = '65123456789abc0011223344';
const tokenPayload = { userId } as any;

jest.mock('jose', () => ({
  jwtVerify: jest.fn(async () => ({ payload: tokenPayload })),
}));

const makeReq = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('cookie', 'session_token=abc');
  const urlObj = new URL(url, 'http://localhost');
  return new Request(urlObj.toString(), { 
    ...init, 
    headers,
    // @ts-ignore
    next: { params: {} } 
  });
};

// Mock the Car model
const mockCars = [
  {
    _id: 'car1',
    make: 'Toyota',
    model: 'Hilux',
    year: 2023,
    price: 450000,
    status: 'in-stock',
    images: [{ imageUrl: 'https://example.com/car1.jpg' }],
    coverImageIndex: 0
  },
  {
    _id: 'car2',
    make: 'Ford',
    model: 'Ranger',
    year: 2022,
    price: 380000,
    status: 'in-stock',
    images: [{ imageUrl: 'https://example.com/car2.jpg' }]
  }
];

jest.mock('@/models/Car', () => ({
  find: jest.fn(() => ({
    populate: jest.fn(() => Promise.resolve(mockCars))
  }))
}));

// Mock the WhatsAppGeneration model
const mockGeneration = {
  _id: 'generation-id',
  save: jest.fn(() => Promise.resolve())
};

jest.mock('@/models/WhatsAppGeneration', () => 
  jest.fn(() => mockGeneration)
);

describe('WhatsApp API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/whatsapp/generate', () => {
    it('should return car data for image generation', async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          success: true,
          generationId: 'generation-id',
          cars: [
            {
              id: 'car1',
              make: 'Toyota',
              model: 'Hilux',
              year: 2023,
              price: 450000,
              coverImage: 'https://example.com/car1.jpg'
            }
          ]
        }),
        status: 200
      };

      generatePOST.mockResolvedValue(mockResponse);

      const request = makeReq('http://localhost/api/whatsapp/generate', {
        method: 'POST'
      });

      const response = await generatePOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cars).toHaveLength(1);
      expect(data.cars[0]).toMatchObject({
        id: 'car1',
        make: 'Toyota',
        model: 'Hilux',
        year: 2023,
        price: 450000,
        coverImage: 'https://example.com/car1.jpg'
      });
    });

    it('should return 404 when no cars with images found', async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          error: 'No in-stock cars with images found'
        }),
        status: 404
      };

      generatePOST.mockResolvedValue(mockResponse);

      const request = makeReq('http://localhost/api/whatsapp/generate', {
        method: 'POST'
      });

      const response = await generatePOST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No in-stock cars with images found');
    });
  });

  describe('POST /api/whatsapp/complete', () => {
    it('should update generation status', async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          success: true
        }),
        status: 200
      };

      completePOST.mockResolvedValue(mockResponse);

      const request = makeReq('http://localhost/api/whatsapp/complete', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'generation-id',
          status: 'completed'
        })
      });

      const response = await completePOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when generation not found', async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          error: 'Generation not found'
        }),
        status: 404
      };

      completePOST.mockResolvedValue(mockResponse);

      const request = makeReq('http://localhost/api/whatsapp/complete', {
        method: 'POST',
        body: JSON.stringify({
          generationId: 'invalid-id',
          status: 'completed'
        })
      });

      const response = await completePOST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Generation not found');
    });
  });
});
