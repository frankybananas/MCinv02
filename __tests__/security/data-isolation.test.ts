import { matchClientToInventory } from '../../lib/matching/match-engine';
import ClientRequest from '../../models/ClientRequest';
import VehicleMatch from '../../models/VehicleMatch';
import Car from '../../models/Car';

// Mock dependencies
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

jest.mock('../../lib/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('../../models/ClientRequest', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  }
}));
jest.mock('../../models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  }
}));
jest.mock('../../models/VehicleMatch', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock('../../lib/matching/scoring', () => ({
  calculateMatchScore: jest.fn().mockReturnValue({ totalScore: 80, breakdown: {} })
}));

describe('Security: Data Isolation', () => {
  it('should copy createdByPhone from Request to Match', async () => {
    const mockRequest = {
      _id: 'req1',
      status: 'active',
      filters: {},
      createdByPhone: 'user_phone_123',
      save: jest.fn(),
      aiParsing: {}
    };

    const mockRequestDoc = {
        ...mockRequest,
        populate: jest.fn().mockResolvedValue({
            ...mockRequest,
            client: { userId: 'user1' }
        })
    };

    (ClientRequest.findById as jest.Mock).mockResolvedValue(mockRequestDoc);

    // Mock Car.find().populate()
    const mockCars = [{ _id: 'car1', status: 'In-Stock' }];
    (Car.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCars)
    });

    (VehicleMatch.findOneAndUpdate as jest.Mock).mockResolvedValue({});

    await matchClientToInventory('req1');

    // Check that findOneAndUpdate was called with createdByPhone set to request's owner
    expect(VehicleMatch.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdByPhone: 'user_phone_123'
      }),
      expect.anything()
    );
  });
});
