// Mock auth-session
jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => ({ 
    phone: '+27821234567', 
    userId: 'user-id', 
    role: 'user',
    payload: { jti: 'test-jti' }
  })),
}));

import { GET } from '@/app/api/image-proxy/route'
import { NextRequest } from 'next/server'

// Provide a local mock of next/server that supports constructor + json when running this file alone
jest.mock('next/server', () => {
  class SimpleNextResponse {
    body: any
    status: number
    headers: any
    constructor(body?: any, init?: { status?: number; headers?: any }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }
    static json(data: any, init?: { status?: number; headers?: any }) {
      return new (this as any)(typeof data === 'string' ? data : JSON.stringify(data), init)
    }
    async json() {
      if (typeof this.body === 'string') try { return JSON.parse(this.body) } catch { return { body: this.body } }
      return this.body
    }
    async text() {
      if (typeof this.body === 'string') return this.body
      try { return JSON.stringify(this.body) } catch { return '' }
    }
  }
  return { NextResponse: SimpleNextResponse }
})

describe('GET /api/image-proxy', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.clearAllMocks()
    global.fetch = originalFetch as any
  })

  const mkReq = (url: string) => new Request(url) as unknown as NextRequest

  it('returns 400 when src is missing', async () => {
    const res = await GET(mkReq('https://example.com/api/image-proxy'))
    // @ts-ignore
    expect(res.status).toBe(400)
    // @ts-ignore
    const data = await res.json()
    expect(data.error).toMatch(/Missing src/i)
  })

  it('returns 400 when src is invalid', async () => {
    const res = await GET(mkReq('https://example.com/api/image-proxy?src=::::bad'))
    // @ts-ignore
    expect(res.status).toBe(400)
    // @ts-ignore
    const data = await res.json()
    expect(data.error).toMatch(/Invalid src/i)
  })

  it('proxies image bytes on success', async () => {
    const mockArrayBuffer = new Uint8Array([1,2,3]).buffer;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: (key: string) => key.toLowerCase() === 'content-type' ? 'image/webp' : null },
      arrayBuffer: async () => mockArrayBuffer,
    })) as any
    const res = await GET(mkReq('https://example.com/api/image-proxy?src=https%3A%2F%2Fimages.example.com%2Fpic.webp'))
    // @ts-ignore
    expect(res.status).toBe(200)
  })

  it('returns 502 when upstream fails', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
    })) as any
    const res = await GET(mkReq('https://example.com/api/image-proxy?src=https%3A%2F%2Fimages.example.com%2Fpic.webp'))
    // @ts-ignore
    expect(res.status).toBe(502)
    // @ts-ignore
    const data = await res.json()
    expect(data.error).toMatch(/Upstream fetch failed/i)
  })
})
