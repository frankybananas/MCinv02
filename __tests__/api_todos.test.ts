import { GET, POST } from '@/app/api/todos/route';
import { PUT, DELETE as DEL } from '@/app/api/todos/[id]/route';

// Mocks
jest.mock('@/lib/mongodb', () => ({ connect: jest.fn(async () => {}) }));

const userId = '65123456789abc0011223344';
const tokenPayload = { userId } as any;

// Simulate jose.jwtVerify to always return our userId
jest.mock('jose', () => ({
  jwtVerify: jest.fn(async () => ({ payload: tokenPayload })),
}));

const makeReq = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  // include cookie header to pass auth check
  headers.set('cookie', 'session_token=abc');
  return new Request(url, { ...init, headers });
};

// In-memory fake store for Todo
const store: any[] = [];

jest.mock('@/models/User', () => ({ __esModule: true, default: {
  findById: jest.fn(async (id: string) => ({ _id: id, todoEnabled: true })),
}}));

jest.mock('@/models/Todo', () => ({ __esModule: true, default: {
  find: jest.fn(async (q: any) => store
    .filter(x => String(x.user) === String(q.user) && (!q.date || (x.date >= q.date['$gte'] && x.date <= q.date['$lte'])))
    .sort((a,b) => (a.date.getTime()-b.date.getTime()) || (a.order-b.order) || (a.createdAt.getTime()-b.createdAt.getTime()))),
  findOne: jest.fn(async (q: any) => store
    .filter(x => String(x.user)===String(q.user) && x.date>=q.date['$gte'] && x.date<=q.date['$lte'])
    .sort((a,b)=>b.order-a.order)[0] || null),
  findOneAndUpdate: jest.fn(async (q: any, upd: any) => {
    const i = store.findIndex(x => String(x._id)===String(q._id) && String(x.user)===String(q.user));
    if (i === -1) return null;
    if (upd?.$set) Object.assign(store[i], upd.$set);
    return store[i];
  }),
  findOneAndDelete: jest.fn(async (q: any) => {
    const i = store.findIndex(x => String(x._id)===String(q._id) && String(x.user)===String(q.user));
    if (i === -1) return null;
    const [removed] = store.splice(i,1);
    return removed;
  }),
  create: jest.fn(async (x: any) => { const now = new Date(); const doc = { _id: String(now.getTime()), createdAt: now, updatedAt: now, order: x.order ?? 0, ...x }; store.push(doc); return doc; }),
}}));

const todayIso = () => new Date().toISOString().substring(0,10);

describe('API /api/todos', () => {
  beforeEach(() => { store.length = 0; jest.clearAllMocks(); });

  it('lists empty by default', async () => {
    const res = await GET(makeReq(`http://localhost/api/todos?date=${todayIso()}`) as any);
    expect(res.status).toBe(200);
    const j = await (res as any).json();
    expect(Array.isArray(j.data)).toBe(true);
    expect(j.data.length).toBe(0);
  });

  it('creates and lists todo for the day', async () => {
    const date = todayIso();
    const post = await POST(makeReq('http://localhost/api/todos', { method: 'POST', body: JSON.stringify({ date, title: 'Call client' }), headers: { 'Content-Type': 'application/json' } }) as any);
    expect(post.status).toBe(201);
    const res = await GET(makeReq(`http://localhost/api/todos?date=${date}`) as any);
    const j = await (res as any).json();
    expect(j.data[0].title).toBe('Call client');
  });

  it('updates title and order', async () => {
    const date = todayIso();
    const created = await POST(makeReq('http://localhost/api/todos', { method: 'POST', body: JSON.stringify({ date, title: 'A' }), headers: { 'Content-Type': 'application/json' } }) as any);
    const cj = await (created as any).json();
    const id = cj.data._id;
    const put = await PUT(makeReq(`http://localhost/api/todos/${id}`, { method: 'PUT', body: JSON.stringify({ title: 'B', order: 3 }), headers: { 'Content-Type': 'application/json' } }) as any, { params: { id } } as any);
    expect(put.status).toBe(200);
    const res = await GET(makeReq(`http://localhost/api/todos?date=${date}`) as any);
    const j = await (res as any).json();
    expect(j.data[0].title).toBe('B');
    expect(j.data[0].order).toBe(3);
  });

  it('deletes item', async () => {
    const date = todayIso();
    const created = await POST(makeReq('http://localhost/api/todos', { method: 'POST', body: JSON.stringify({ date, title: 'Bye' }), headers: { 'Content-Type': 'application/json' } }) as any);
    const cj = await (created as any).json();
    const id = cj.data._id;
    const del = await DEL(makeReq(`http://localhost/api/todos/${id}`, { method: 'DELETE' }) as any, { params: { id } } as any);
    expect(del.status).toBe(200);
    const res = await GET(makeReq(`http://localhost/api/todos?date=${date}`) as any);
    const j = await (res as any).json();
    expect(j.data.length).toBe(0);
  });
});
