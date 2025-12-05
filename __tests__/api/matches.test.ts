import { GET } from '@/app/api/matches/route';
import { NextRequest, NextResponse } from 'next/server';
import VehicleMatch from '@/models/VehicleMatch';
import { requireSession } from '@/lib/auth-session';

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    blob() { return Promise.resolve(new Blob()); }
    clone() { return this; }
  },
  NextResponse: {
    json: (body: any, init?: any) => ({
      json: async () => body,
      status: init?.status || 200,
    }),
  },
}));

jest.mock('mongoose', () => {
  const MockSchema = class {
    index() {}
    pre() {}
  };
  (MockSchema as any).Types = { ObjectId: class {} };
  return {
    Schema: MockSchema,
    model: jest.fn(),
    models: {},
    Types: { ObjectId: class {} }
  };
});

jest.mock('@/lib/auth-session');
jest.mock('@/models/VehicleMatch', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));

describe('Matches API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch matches for authenticated user', async () => {
    (requireSession as jest.Mock).mockResolvedValue({ phone: '123' });

    const mockMatches = [{ _id: 'match1', score: 90 }];
    const mockFindChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      // The second populate is chained
      // So populate() returns 'this' again
      // Finally it should behave like a Promise when awaited
      then: (resolve: any) => resolve(mockMatches) 
    };

    // Need to handle chaining properly for mongoose mocks
    // VehicleMatch.find returns Query
    // Query.sort returns Query
    // Query.skip returns Query
    // Query.limit returns Query
    // Query.populate returns Query
    
    // We can just return the chain object for all these methods
    (mockFindChain as any).sort.mockReturnValue(mockFindChain);
    (mockFindChain as any).skip.mockReturnValue(mockFindChain);
    (mockFindChain as any).limit.mockReturnValue(mockFindChain);
    (mockFindChain as any).populate.mockReturnValue(mockFindChain); // First populate
    
    (VehicleMatch.find as jest.Mock).mockReturnValue(mockFindChain);
    (VehicleMatch.countDocuments as jest.Mock).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/matches');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(mockMatches);
    expect(VehicleMatch.find).toHaveBeenCalledWith({ createdByPhone: '123' });
  });

  it('should filter by requestId', async () => {
    (requireSession as jest.Mock).mockResolvedValue({ phone: '123' });
    
    // Setup mock chain
    const mockFindChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      then: (resolve: any) => resolve([])
    };
    (VehicleMatch.find as jest.Mock).mockReturnValue(mockFindChain);
    (VehicleMatch.countDocuments as jest.Mock).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/matches?requestId=req1');
    await GET(req);

    expect(VehicleMatch.find).toHaveBeenCalledWith({
      createdByPhone: '123',
      request: 'req1'
    });
  });
});
