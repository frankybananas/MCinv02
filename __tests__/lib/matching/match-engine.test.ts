import { matchClientToInventory } from '@/lib/matching/match-engine';
import ClientRequest from '@/models/ClientRequest';
import Car from '@/models/Car';
import VehicleMatch from '@/models/VehicleMatch';
import { calculateMatchScore } from '@/lib/matching/scoring';

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

jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/models/ClientRequest', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  }
}));
jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
  }
}));
jest.mock('@/models/VehicleMatch', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));
jest.mock('@/lib/matching/scoring');

describe('Match Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should match client to inventory', async () => {
    const mockRequest = {
      _id: 'req1',
      status: 'active',
      filters: { makes: ['Toyota'] },
      createdByPhone: '123',
      save: jest.fn(),
      aiParsing: {}
    };

    // Mock ClientRequest.findById to return object with populate
    // In match-engine: await ClientRequest.findById(clientRequestId);
    // Then await request.populate('client');
    // But wait, mongoose findById returns a Query/Promise.
    // The code does:
    // const request = await ClientRequest.findById(clientRequestId);
    // ...
    // const populatedRequest = await request.populate('client');
    
    const mockRequestDoc = {
        ...mockRequest,
        populate: jest.fn().mockResolvedValue({
            ...mockRequest,
            client: { userId: 'user1' }
        })
    };

    (ClientRequest.findById as jest.Mock).mockResolvedValue(mockRequestDoc);

    const mockCar = {
      _id: 'car1',
      make: 'Toyota',
      model: 'Corolla',
      status: 'In-Stock',
      images: ['img1.jpg']
    };

    // Mock Car.find().populate()
    const mockFindChain = {
      populate: jest.fn().mockResolvedValue([mockCar])
    };
    (Car.find as jest.Mock).mockReturnValue(mockFindChain);

    (calculateMatchScore as jest.Mock).mockReturnValue({
      totalScore: 80,
      quality: 'good',
      breakdown: {}
    });

    (VehicleMatch.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'match1' });
    (VehicleMatch.countDocuments as jest.Mock).mockResolvedValue(1);

    const matches = await matchClientToInventory('req1');

    expect(matches).toHaveLength(1);
    expect(VehicleMatch.findOneAndUpdate).toHaveBeenCalled();
    expect(mockRequestDoc.save).toHaveBeenCalled();
  });
});
