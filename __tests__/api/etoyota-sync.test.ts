// Use same mocking pattern as rest of test suite
jest.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    method: string;
    headers: Headers;
    constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
      this.url = url;
      this.method = init?.method ?? 'GET';
      this.headers = new Headers(init?.headers);
    }
  },
  NextResponse: {
    json: (body: any, init?: any) => ({
      json: async () => body,
      status: init?.status ?? 200,
    }),
  },
}));

jest.mock('@/lib/etoyota/sync-engine', () => ({
  runSync: jest.fn(),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
}));

const { runSync } = require('@/lib/etoyota/sync-engine');
const { requireSession } = require('@/lib/auth-session');
const { NextRequest } = require('next/server');

const CRON_SECRET = 'test-cron-secret-abc';
process.env.CRON_SECRET = CRON_SECRET;

function makeRequest(
  method = 'POST',
  headers: Record<string, string> = {}
) {
  return new NextRequest('http://localhost:3000/api/cron/etoyota-sync', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('POST /api/cron/etoyota-sync', () => {
  let POST: (req: any) => Promise<{ json: () => Promise<any>; status: number }>;

  beforeAll(async () => {
    const mod = await import('@/app/api/cron/etoyota-sync/route');
    POST = mod.POST as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth header', async () => {
    const res = await POST(makeRequest('POST'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns 401 with wrong token', async () => {
    const res = await POST(makeRequest('POST', { authorization: 'Bearer wrong-token' }));
    expect(res.status).toBe(401);
  });

  it('runs sync with correct Bearer token', async () => {
    runSync.mockResolvedValue({
      vehiclesAdded: 3,
      vehiclesUpdated: 10,
      vehiclesFlagged: 1,
      vehiclesReturned: 0,
      totalFetched: 42,
      syncErrors: [],
      durationMs: 1500,
    });

    const res = await POST(makeRequest('POST', { authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.vehiclesAdded).toBe(3);
    expect(data.vehiclesUpdated).toBe(10);
    expect(runSync).toHaveBeenCalledWith('cron');
  });

  it('returns 500 when sync engine throws', async () => {
    runSync.mockRejectedValue(new Error('e-Toyota API down'));

    const res = await POST(makeRequest('POST', { authorization: `Bearer ${CRON_SECRET}` }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toContain('e-Toyota API down');
  });
});

describe('GET /api/cron/etoyota-sync', () => {
  let GET: (req: any) => Promise<{ json: () => Promise<any>; status: number }>;

  beforeAll(async () => {
    const mod = await import('@/app/api/cron/etoyota-sync/route');
    GET = mod.GET as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts GET with correct token', async () => {
    runSync.mockResolvedValue({
      vehiclesAdded: 0,
      vehiclesUpdated: 5,
      vehiclesFlagged: 0,
      vehiclesReturned: 0,
      totalFetched: 20,
      syncErrors: [],
      durationMs: 800,
    });

    const req = new NextRequest('http://localhost:3000/api/cron/etoyota-sync', {
      method: 'GET',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns 401 on GET with wrong token', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/etoyota-sync', {
      method: 'GET',
      headers: { authorization: 'Bearer bad' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/sync/trigger', () => {
  let POST: (req: any) => Promise<{ json: () => Promise<any>; status: number }>;

  beforeAll(async () => {
    const mod = await import('@/app/api/sync/trigger/route');
    POST = mod.POST as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    requireSession.mockRejectedValue(new Error('Unauthorized'));

    const req = new NextRequest('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin/manager role', async () => {
    requireSession.mockResolvedValue({ role: 'user', phone: '+27123456789' });

    const req = new NextRequest('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toBe('Forbidden');
  });

  it('runs sync for admin role', async () => {
    requireSession.mockResolvedValue({ role: 'admin', phone: '+27123456789' });
    runSync.mockResolvedValue({
      vehiclesAdded: 2,
      vehiclesUpdated: 8,
      vehiclesFlagged: 0,
      vehiclesReturned: 0,
      totalFetched: 35,
      syncErrors: [],
      durationMs: 2000,
    });

    const req = new NextRequest('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(runSync).toHaveBeenCalledWith('manual');
  });

  it('runs sync for manager role', async () => {
    requireSession.mockResolvedValue({ role: 'manager', phone: '+27111111111' });
    runSync.mockResolvedValue({
      vehiclesAdded: 0,
      vehiclesUpdated: 3,
      vehiclesFlagged: 0,
      vehiclesReturned: 0,
      totalFetched: 10,
      syncErrors: [],
      durationMs: 500,
    });

    const req = new NextRequest('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 when sync throws', async () => {
    requireSession.mockResolvedValue({ role: 'admin', phone: '+27123456789' });
    runSync.mockRejectedValue(new Error('Network failure'));

    const req = new NextRequest('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/sync/logs', () => {
  let GET: (req: any) => Promise<{ json: () => Promise<any>; status: number }>;

  beforeAll(async () => {
    const mod = await import('@/app/api/sync/logs/route');
    GET = mod.GET as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin/manager roles', async () => {
    requireSession.mockResolvedValue({ role: 'user', phone: '+27123456789' });

    const req = new NextRequest('http://localhost:3000/api/sync/logs');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 for recon role', async () => {
    requireSession.mockResolvedValue({ role: 'recon', phone: '+27123456789' });

    const req = new NextRequest('http://localhost:3000/api/sync/logs');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
