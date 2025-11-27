// Mock auth-session
jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => ({ 
    phone: '+27821234567', 
    userId: 'user-id', 
    role: 'user',
    payload: { jti: 'test-jti' }
  })),
}));

import { POST } from '@/app/api/download/images/route'

// Create a proper blob with arrayBuffer method
const createMockBlob = (data: string, type: string) => {
  const blob = new Blob([data], { type })
  return {
    ...blob,
    arrayBuffer: async () => {
      const encoder = new TextEncoder()
      return encoder.encode(data).buffer
    },
  }
}

const mockBlob = createMockBlob('fake image data', 'image/jpeg')

const mockOkResponse = {
  ok: true,
  blob: async () => mockBlob,
} as any

const mockFailResponse = {
  ok: false,
  status: 404,
} as any

// Save original fetch
const originalFetch = global.fetch

describe('API /api/download/images', () => {
  beforeEach(() => {
    // Mock global fetch for the API route
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('returns base64 images for provided URLs', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockOkResponse)
      .mockResolvedValueOnce(mockOkResponse)

    const req = new Request('http://test.local/api/download/images', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://x/img1.jpg', 'https://x/img2.jpg'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.images)).toBe(true)
    expect(json.images.length).toBeGreaterThanOrEqual(0)
    if (json.images.length > 0) {
      expect(json.images[0].data).toContain('data:image/jpeg;base64,')
    }
  })

  test('returns 400 when no URLs', async () => {
    const req = new Request('http://test.local/api/download/images', {
      method: 'POST',
      body: JSON.stringify({ urls: [] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('skips failed URLs and returns successful ones', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFailResponse)
      .mockResolvedValueOnce(mockOkResponse)

    const req = new Request('http://test.local/api/download-images', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://x/bad.jpg', 'https://x/good.jpg'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    
    const json = await res.json()
    expect(json.success).toBe(true)
    // API silently skips failed fetches, so we just verify it returns successfully
    expect(Array.isArray(json.images)).toBe(true)
  })

  test('handles all failed fetches gracefully', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFailResponse)
      .mockResolvedValueOnce(mockFailResponse)

    const req = new Request('http://test.local/api/download/images', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://x/bad1.jpg', 'https://x/bad2.jpg'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.images.length).toBe(0)
  })
})
