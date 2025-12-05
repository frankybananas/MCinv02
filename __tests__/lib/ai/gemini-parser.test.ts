import { parseClientRequest } from '@/lib/ai/gemini-parser';
import { generateJson } from '@/lib/ai/gemini-client';

jest.mock('@/lib/ai/gemini-client');

describe('Gemini Parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse a simple request', async () => {
    const mockResponse = {
      filters: {
        makes: ['Toyota'],
        models: ['Corolla'],
        minYear: 2020
      },
      confidence: 0.9,
      ambiguities: []
    };

    (generateJson as jest.Mock).mockResolvedValue(mockResponse);

    const result = await parseClientRequest('Looking for a 2020 Toyota Corolla');
    
    expect(result).toEqual(mockResponse);
    expect(generateJson).toHaveBeenCalledWith(expect.stringContaining('Toyota Corolla'));
  });

  it('should handle complex requests', async () => {
    const mockResponse = {
      filters: {
        makes: ['BMW'],
        minBudgetZar: 300000,
        maxBudgetZar: 400000,
        fuelTypes: ['Diesel'],
        transmissions: ['Automatic']
      },
      confidence: 0.85,
      ambiguities: []
    };

    (generateJson as jest.Mock).mockResolvedValue(mockResponse);

    const result = await parseClientRequest('BMW diesel automatic between R300k and R400k');
    
    expect(result).toEqual(mockResponse);
  });
});
