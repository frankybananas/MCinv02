// Mock auth-session
jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => ({ 
    phone: '+27821234567', 
    userId: 'user-id', 
    role: 'user',
    payload: { jti: 'test-jti' }
  })),
}));

import { POST } from '@/app/api/download/zip/route'

// Mock global fetch used inside the API route to download remote images
const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

const mockOkResponse = {
  ok: true,
  blob: async () => mockBlob,
} as any

const mockFailResponse = {
  ok: false,
  status: 404,
} as any

describe('API /api/download/zip', () => {
  beforeEach(() => {
    ;(global.fetch as any) = jest.fn()
  })

  test('returns success response for provided URLs', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockOkResponse)
      .mockResolvedValueOnce(mockOkResponse)

    const req = new Request('http://test.local/api/download/zip', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://x/img1.jpg', 'https://x/img2.jpg'], filenamePrefix: 'car' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  test('returns 400 when no URLs', async () => {
    const req = new Request('http://test.local/api/download/zip', {
      method: 'POST',
      body: JSON.stringify({ urls: [] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('skips failed URLs and still creates zip', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFailResponse)
      .mockResolvedValueOnce(mockOkResponse)

    const req = new Request('http://test.local/api/download/zip', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://x/bad.jpg', 'https://x/good.jpg'], filenamePrefix: 'car' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
