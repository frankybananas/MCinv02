import { POST } from '@/app/api/cron/match-requests/route';
import ClientRequest from '@/models/ClientRequest';
import { parseClientRequest } from '@/lib/ai/gemini-parser';
import { matchClientToInventory } from '@/lib/matching/match-engine';
import { markCronError, markCronRunning, markCronSuccess } from '@/lib/cron-metadata';

jest.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    headers: Headers;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.url = url;
      this.headers = new Headers(init?.headers);
    }
  },
  NextResponse: {
    json: (body: any, init?: any) => ({
      json: async () => body,
      status: init?.status || 200,
    }),
  },
}));

jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/models/ClientRequest', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock('@/lib/ai/gemini-parser', () => ({
  parseClientRequest: jest.fn(),
}));

jest.mock('@/lib/matching/match-engine', () => ({
  matchClientToInventory: jest.fn(),
}));

jest.mock('@/lib/cron-metadata', () => ({
  markCronRunning: jest.fn(),
  markCronSuccess: jest.fn(),
  markCronError: jest.fn(),
}));

describe('Cron /api/cron/match-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 401 when unauthorized', async () => {
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/cron/match-requests', {
      headers: { authorization: 'Bearer wrong' },
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(markCronRunning).not.toHaveBeenCalled();
    expect(markCronSuccess).not.toHaveBeenCalled();
    expect(markCronError).not.toHaveBeenCalled();
  });

  it('processes parse+match and match-only requests', async () => {
    const { NextRequest } = await import('next/server');

    const parseDoc: any = {
      _id: 'req1',
      freeText: 'Looking for Toyota',
      status: 'active',
      filters: {},
      aiParsing: undefined,
      save: jest.fn().mockResolvedValue(undefined),
      createdByPhone: '123',
    };

    const matchDoc: any = {
      _id: 'req2',
      status: 'active',
      filters: { makes: ['Toyota'] },
      aiParsing: {},
      save: jest.fn().mockResolvedValue(undefined),
      createdByPhone: '123',
    };

    (ClientRequest.find as jest.Mock)
      .mockImplementationOnce((query: any) => ({
        limit: jest.fn().mockResolvedValue([parseDoc]),
      }))
      .mockImplementationOnce((query: any) => ({
        limit: jest.fn().mockResolvedValue([matchDoc]),
      }));

    (parseClientRequest as jest.Mock).mockResolvedValue({
      confidence: 0.9,
      ambiguities: [],
      filters: { makes: ['Toyota'] },
    });

    (matchClientToInventory as jest.Mock).mockResolvedValue([{ _id: 'match1' }]);

    const req = new NextRequest('http://localhost/api/cron/match-requests', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(parseClientRequest).toHaveBeenCalledWith('Looking for Toyota');
    expect(matchClientToInventory).toHaveBeenCalledWith('req1');
    expect(matchClientToInventory).toHaveBeenCalledWith('req2');
    expect(parseDoc.save).toHaveBeenCalled();

    expect((ClientRequest.find as jest.Mock).mock.calls).toHaveLength(2);
    expect((ClientRequest.find as jest.Mock).mock.calls[1][0]).toEqual(
      expect.objectContaining({
        status: 'active',
        $and: expect.any(Array),
      })
    );

    expect(markCronRunning).toHaveBeenCalledWith('match-requests');
    expect(markCronSuccess).toHaveBeenCalledWith(
      'match-requests',
      expect.objectContaining({
        message: expect.any(String),
        durationMs: expect.any(Number),
      })
    );
    expect(markCronError).not.toHaveBeenCalled();
  });
});
