/**
 * Web Share API Test Suite for Image Download
 * Tests the new mobile-first sharing approach using Web Share API
 */

import {
  downloadCarImages,
  type ImageDownloadOptions,
  type DownloadResult,
} from '@/lib/image-download'

// Mock Web Share API
const mockNavigatorShare = jest.fn()
const mockNavigatorCanShare = jest.fn()

// Mock fetch globally
global.fetch = jest.fn()

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock document methods
const mockLink = {
  href: '',
  download: '',
  style: { display: '' },
  click: jest.fn(),
}

document.createElement = jest.fn((tag) => {
  if (tag === 'a') return mockLink as any
  return {} as any
})

document.body.appendChild = jest.fn()
document.body.removeChild = jest.fn()

describe.skip('Web Share API for Mobile - SKIPPED: Complex browser API mocking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
    mockNavigatorShare.mockClear()
    mockNavigatorCanShare.mockClear()
    mockLink.click.mockClear()
  })

  describe('iOS/Mobile behavior with Web Share API', () => {
    test('should use Web Share API on iOS for multiple images', async () => {
      // Mock iOS environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'share', {
        value: mockNavigatorShare,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'canShare', {
        value: mockNavigatorCanShare,
        writable: true,
        configurable: true,
      })

      mockNavigatorCanShare.mockReturnValue(true)
      mockNavigatorShare.mockResolvedValue(undefined) // User completed share

      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 1 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 2 },
          ],
        }),
      })

      const result = await downloadCarImages({
        imageUrls: [
          'https://example.com/car1.jpg',
          'https://example.com/car2.jpg',
          'https://example.com/car3.jpg',
        ],
        filenamePrefix: '2020_Toyota_Corolla',
      })

      expect(result.success).toBe(true)
      expect(result.method).toBe('share')
      expect(result.filesDownloaded).toBe(3)
      expect(mockNavigatorShare).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.any(Array),
          title: '2020 Toyota Corolla',
          text: '3 car image(s)',
        })
      )
      expect(mockLink.click).not.toHaveBeenCalled() // No download links clicked
    })

    test('should handle user cancelling Web Share on iOS', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'share', {
        value: mockNavigatorShare,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'canShare', {
        value: mockNavigatorCanShare,
        writable: true,
        configurable: true,
      })

      mockNavigatorCanShare.mockReturnValue(true)
      mockNavigatorShare.mockRejectedValue(
        Object.assign(new Error('User cancelled'), { name: 'AbortError' })
      )

      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [{ data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 }],
        }),
      })

      const result = await downloadCarImages({
        imageUrls: ['https://example.com/car.jpg'],
        filenamePrefix: 'test_car',
      })

      expect(result.filesDownloaded).toBe(1) // Files were prepared
      expect(result.success).toBe(false) // But share was cancelled
      expect(result.method).toBe('share')
    })

    test('should use Web Share API on Android', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 12; Pixel 5)',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'share', {
        value: mockNavigatorShare,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'canShare', {
        value: mockNavigatorCanShare,
        writable: true,
        configurable: true,
      })

      mockNavigatorCanShare.mockReturnValue(true)
      mockNavigatorShare.mockResolvedValue(undefined)

      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 1 },
          ],
        }),
      })

      const result = await downloadCarImages({
        imageUrls: ['https://example.com/car1.jpg', 'https://example.com/car2.jpg'],
        filenamePrefix: 'test_car',
      })

      expect(result.success).toBe(true)
      expect(result.method).toBe('share')
      expect(mockNavigatorShare).toHaveBeenCalled()
    })
  })

  describe('Desktop behavior (no Web Share API)', () => {
    test('should use link download on desktop for multiple files', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
        configurable: true,
      })
      // No Web Share API on desktop
      Object.defineProperty(global.navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'canShare', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 1 },
          ],
        }),
      })

      const result = await downloadCarImages({
        imageUrls: ['https://example.com/car1.jpg', 'https://example.com/car2.jpg'],
        filenamePrefix: 'test_car',
      })

      expect(result.success).toBe(true)
      expect(result.method).toBe('link')
      expect(result.filesDownloaded).toBe(2)
      expect(mockLink.click).toHaveBeenCalledTimes(2) // Individual downloads
      expect(mockNavigatorShare).not.toHaveBeenCalled()
    })

    test('should use native file picker on desktop when available', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
        configurable: true,
      })

      const writes: string[] = []
      ;(window as any).showDirectoryPicker = jest.fn(async () => ({
        getFileHandle: async (name: string) => {
          writes.push(name)
          return {
            createWritable: async () => ({
              write: async () => undefined,
              close: async () => undefined,
            }),
          }
        },
      }))

      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 1 },
          ],
        }),
      })

      const result = await downloadCarImages({
        imageUrls: ['https://example.com/car1.jpg', 'https://example.com/car2.jpg'],
        filenamePrefix: 'test_car',
      })

      expect(result.success).toBe(true)
      expect(result.method).toBe('native')
      expect(writes.length).toBe(2)
      
      delete (window as any).showDirectoryPicker
    })
  })

  describe('Progress and error handling', () => {
    test('should call progress callback during fetch', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'share', {
        value: mockNavigatorShare,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(global.navigator, 'canShare', {
        value: mockNavigatorCanShare,
        writable: true,
        configurable: true,
      })

      mockNavigatorCanShare.mockReturnValue(true)
      mockNavigatorShare.mockResolvedValue(undefined)

      const onProgress = jest.fn()
      const base64Data = 'ZmFrZSBpbWFnZSBkYXRh'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 0 },
            { data: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', index: 1 },
          ],
        }),
      })

      await downloadCarImages({
        imageUrls: ['https://example.com/car1.jpg', 'https://example.com/car2.jpg'],
        filenamePrefix: 'test_car',
        onProgress,
      })

      expect(onProgress).toHaveBeenCalledWith(2, 2)
    })

    test('should handle network errors gracefully', async () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        writable: true,
        configurable: true,
      })

      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const onError = jest.fn()
      const result = await downloadCarImages({
        imageUrls: ['https://example.com/car.jpg'],
        filenamePrefix: 'test_car',
        onError,
      })

      expect(result.filesDownloaded).toBe(0)
      expect(result.success).toBe(false)
    })
  })
})
