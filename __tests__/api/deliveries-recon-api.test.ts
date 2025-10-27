/**
 * Deliveries Recon API Test Suite
 *
 * Tests recon scope listing and recon-limited updates on deliveries.
 * Target Coverage: 80%+
 */

import { NextResponse } from 'next/server';

// Mocks
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

// Mock jose jwtVerify to bypass real token
jest.mock('jose', () => ({
  jwtVerify: jest.fn(async () => ({ payload: { phone: '+27111111111' } })),
}));

// Mock next/headers to control role in tests
const headersMock = jest.fn();
jest.mock('next/headers', () => ({
  headers: () => headersMock(),
}));

// In-memory delivery store
const deliveries: any[] = [];
let lastUpdateQuery: any = null;
let lastUpdateSet: any = null;

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    find: jest.fn((query: any) => {
      let results = [...deliveries];
      if (query.status) {
        results = results.filter(d => d.status === query.status);
      }
      if (query.$or) {
        results = results.filter(d => {
          const hasTasks = Array.isArray(d.reconTasks) && d.reconTasks.length > 0;
          const hasDate = !!d.deliveryDate;
          return (query.$or as any[]).some(cond => {
            if (cond.reconTasks) return hasTasks;
            if (cond.deliveryDate && cond.deliveryDate.$ne === null) return hasDate;
            return false;
          });

  test('GET /api/deliveries/[id] returns any item for recon role', async () => {
    headersMock.mockReturnValue(new Headers({ 'x-user-role': 'recon' }));
    deliveries.push({ _id: 'd9', salesperson: 'someone-else', status: 'active', reconTasks: [], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
    const { GET } = await import('@/app/api/deliveries/[id]/route');
    const req = new Request('http://localhost/api/deliveries/d9', { headers: { cookie: 'session_token=fake', 'x-user-phone': '+27111111111' } as any });
    const res = await (GET as any)(req, { params: { id: 'd9' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.success).toBe(true);
    expect(String(body?.data?._id)).toBe('d9');
  });
        });
      }
      if (query.salesperson) {
        results = results.filter(d => String(d.salesperson) === String(query.salesperson));
      }
      return {
        populate: jest.fn(() => ({ populate: jest.fn(() => ({ sort: jest.fn(() => results) }) ) })),
        sort: jest.fn(() => results),
      } as any;
    }),
    findOne: jest.fn(async (query: any) => {
      return deliveries.find(d => String(d._id) === String(query._id) && (!query.salesperson || String(d.salesperson) === String(query.salesperson))) || null;
    }),
    findOneAndUpdate: jest.fn(async (query: any, update: any) => {
      lastUpdateQuery = query;
      lastUpdateSet = update;
      const idx = deliveries.findIndex(d => String(d._id) === String(query._id) && (!query.salesperson || String(d.salesperson) === String(query.salesperson)));
      if (idx === -1) return null;
      const curr = deliveries[idx];
      const next = { ...curr, ...update, updatedAt: new Date().toISOString() };
      deliveries[idx] = next;
      return next;
    })
  },
}));

// Minimal User model mock (used to find default recon)
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn((q: any) => {
      if (q && q.phone) {
        return { select: jest.fn(() => ({ _id: 'user1' })) } as any;
      }
      if (q && q.role === 'recon') {
        return { select: jest.fn(() => ({ sort: jest.fn(() => ({ _id: 'reconA' })) })) } as any;
      }
      return null;
    }),
  },
}));

// Mock Car and Client models to avoid ESM/mongoose imports
jest.mock('@/models/Car', () => ({ __esModule: true, default: {} }));
jest.mock('@/models/Client', () => ({ __esModule: true, default: {} }));

describe('Deliveries Recon API', () => {
  beforeEach(() => {
    deliveries.length = 0;
    lastUpdateQuery = null;
    lastUpdateSet = null;
  });
  beforeAll(() => {
    process.env.JWT_SECRET = 'test_secret';
  });

  test('GET /api/deliveries?scope=recon returns active deliveries with tasks or date for recon role', async () => {
    headersMock.mockReturnValue(new Headers({ 'x-user-role': 'recon' }));
    deliveries.push(
      { _id: 'd1', salesperson: 'user1', status: 'active', reconTasks: [{ text: 'Clean', done: false }], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      { _id: 'd2', salesperson: 'user2', status: 'active', deliveryDate: new Date().toISOString(), updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      { _id: 'd3', salesperson: 'user3', status: 'canceled', reconTasks: [{ text: 'Fix', done: false }], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    );

    const { GET } = await import('@/app/api/deliveries/route');
    const req = new Request('http://localhost/api/deliveries?scope=recon', { headers: { cookie: 'session_token=fake', 'x-user-phone': '+27111111111' } as any });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const ids = data.data.map((x: any) => x._id);
    expect(ids).toEqual(expect.arrayContaining(['d1','d2']));
    expect(ids).not.toContain('d3');
  });

  test('GET /api/deliveries?scope=recon forbidden for normal user', async () => {
    headersMock.mockReturnValue(new Headers({ 'x-user-role': 'user' }));
    const { GET } = await import('@/app/api/deliveries/route');
    const req = new Request('http://localhost/api/deliveries?scope=recon', { headers: { cookie: 'session_token=fake' } });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  test('PUT /api/deliveries/[id] by recon role only updates reconTasks and sets reconReady', async () => {
    headersMock.mockReturnValue(new Headers({ 'x-user-role': 'recon', 'x-user-phone': '+27111111111' }));
    deliveries.push({ _id: 'd1', salesperson: 'user1', status: 'active', reconTasks: [{ text: 'Clean', done: false }], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() });

    const { PUT } = await import('@/app/api/deliveries/[id]/route');

    const payload = {
      reconTasks: [
        { text: 'Clean', done: true },
        { text: 'Polish', done: true },
      ],
      licensing: { done: true }, // should be ignored for recon role
    };

    const req = new Request('http://localhost/api/deliveries/d1', { method: 'PUT', headers: { 'content-type': 'application/json', cookie: 'session_token=fake', 'x-user-phone': '+27111111111' } as any, body: JSON.stringify(payload) });
    const res = await (PUT as any)(req, { params: { id: 'd1' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.data.reconTasks)).toBe(true);
    expect(data.data.reconReady).toBe(true);
    // Ensure update did not include licensing for recon role
    expect(lastUpdateSet.licensing).toBeUndefined();
    // Ensure only baseQuery by id (no salesperson restriction since recon is privileged)
    expect(String(lastUpdateQuery._id)).toBe('d1');
    expect(lastUpdateQuery.salesperson).toBeUndefined();
  });
});
