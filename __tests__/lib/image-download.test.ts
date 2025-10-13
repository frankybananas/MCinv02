/**
 * Image Download Utility Test Suite
 * 
 * Tests the image download functionality including:
 * - File fetching and conversion
 * - Native download methods
 * - Fallback mechanisms
 * - Error handling
 * - Progress tracking
 * 
 * Target Coverage: 80%+
 */

import {
  downloadCarImages,
  downloadSingleImage,
  hasNativeDownloadSupport,
  estimateDownloadSize,
  formatFileSize,
  type ImageDownloadOptions,
  type DownloadResult,
} from '@/lib/image-download'

// Mock fetch globally
global.fetch = jest.fn()

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock document.createElement and related DOM methods
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

describe('Image Download Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(500)).toBe('500.0 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1048576)).toBe('1.0 MB')
      expect(formatFileSize(1572864)).toBe('1.5 MB')
      expect(formatFileSize(1073741824)).toBe('1.0 GB')
    })

    test('should handle large numbers', () => {
      expect(formatFileSize(999999999)).toContain('MB')
      expect(formatFileSize(1073741824 * 10)).toContain('GB')
    })

    test('should round to 1 decimal place', () => {
      const result = formatFileSize(1234567)
      expect(result).toMatch(/^\d+\.\d{1}\s\w+$/)
    })
  })

  describe('hasNativeDownloadSupport', () => {
    test('should return false when window is undefined', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const support = hasNativeDownloadSupport()
      expect(support.share).toBe(false)
      expect(support.filePicker).toBe(false)

      // @ts-ignore
      global.window = originalWindow
    })

    test('should detect share API support', () => {
      const mockNavigator = {
        share: jest.fn(),
        canShare: jest.fn(),
      }

      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      })

      const support = hasNativeDownloadSupport()
      expect(support.share).toBe(true)
    })

    test('should detect file picker support', () => {
      // Temporarily add showDirectoryPicker to window
      const originalShowDirectoryPicker = (window as any).showDirectoryPicker
      ;(window as any).showDirectoryPicker = jest.fn()

      const support = hasNativeDownloadSupport()
      expect(support.filePicker).toBe(true)

      // Restore
      if (originalShowDirectoryPicker === undefined) {
        delete (window as any).showDirectoryPicker
      } else {
        ;(window as any).showDirectoryPicker = originalShowDirectoryPicker
      }
    })

    test('should return false when APIs not available', () => {
      // Save original values
      const originalNavigator = global.navigator
      const originalShowDirectoryPicker = (window as any).showDirectoryPicker

      // Temporarily modify navigator
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      })

      // Remove showDirectoryPicker
      delete (window as any).showDirectoryPicker

      const support = hasNativeDownloadSupport()
      expect(support.share).toBe(false)
      expect(support.filePicker).toBe(false)

      // Restore original values
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      })

      if (originalShowDirectoryPicker !== undefined) {
        ;(window as any).showDirectoryPicker = originalShowDirectoryPicker
      }
    })
  })

  describe('downloadSingleImage', () => {
    test('should download a single image successfully', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      })

      const result = await downloadSingleImage('https://example.com/image.jpg', 'test_image')

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg', expect.any(Object))
      expect(mockLink.click).toHaveBeenCalled()
    })

    test('should handle fetch errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await downloadSingleImage('https://example.com/image.jpg', 'test_image')

      expect(result).toBe(false)
    })

    test('should handle failed response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await downloadSingleImage('https://example.com/image.jpg', 'test_image')

      expect(result).toBe(false)
    })

    test('should add correct file extension', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      })

      await downloadSingleImage('https://example.com/image', 'test_image')

      expect(mockLink.download).toContain('.png')
    })
  })

  describe('estimateDownloadSize', () => {
    test('should estimate total size from content-length headers', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) => (header === 'content-length' ? '1024' : null),
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header: string) => (header === 'content-length' ? '2048' : null),
          },
        })

      const totalSize = await estimateDownloadSize([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ])

      expect(totalSize).toBe(3072)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    test('should return 0 for empty array', async () => {
      const totalSize = await estimateDownloadSize([])
      expect(totalSize).toBe(0)
    })

    test('should handle missing content-length header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => null,
        },
      })

      const totalSize = await estimateDownloadSize(['https://example.com/image.jpg'])
      expect(totalSize).toBe(0)
    })

    test('should handle fetch errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const totalSize = await estimateDownloadSize(['https://example.com/image.jpg'])
      expect(totalSize).toBe(0)
    })
  })

  describe('downloadCarImages', () => {
    test('should return success for empty image array', async () => {
      const options: ImageDownloadOptions = {
        imageUrls: [],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.success).toBe(true)
      expect(result.filesDownloaded).toBe(0)
      expect(result.totalFiles).toBe(0)
    })

    test('should fetch and download single image', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      })

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image.jpg'],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.filesDownloaded).toBe(1)
      expect(result.totalFiles).toBe(1)
      expect(result.success).toBe(true)
      expect(result.method).toBe('link')
    })

    test('should call progress callback', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
        })

      const onProgress = jest.fn()

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        filenamePrefix: 'test_car',
        onProgress,
      }

      await downloadCarImages(options)

      expect(onProgress).toHaveBeenCalledWith(1, 2)
      expect(onProgress).toHaveBeenCalledWith(2, 2)
    })

    test('should call error callback on fetch failure', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const onError = jest.fn()

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image.jpg'],
        filenamePrefix: 'test_car',
        onError,
      }

      const result = await downloadCarImages(options)

      expect(onError).toHaveBeenCalled()
      expect(result.errors.length).toBe(1)
      expect(result.filesDownloaded).toBe(0)
    })

    test('should handle partial success', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
        })
        .mockRejectedValueOnce(new Error('Network error'))

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.filesDownloaded).toBe(1)
      expect(result.totalFiles).toBe(2)
      expect(result.errors.length).toBe(1)
    })

    test('should handle different image types', async () => {
      const mockPngBlob = new Blob(['fake png data'], { type: 'image/png' })
      const mockWebpBlob = new Blob(['fake webp data'], { type: 'image/webp' })

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockPngBlob,
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockWebpBlob,
        })

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image1.png', 'https://example.com/image2.webp'],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.filesDownloaded).toBe(2)
      expect(result.success).toBe(true)
    })

    test('should use correct filename prefix', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      })

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image.jpg'],
        filenamePrefix: '2020_Toyota_Corolla',
      }

      await downloadCarImages(options)

      expect(mockLink.download).toContain('2020_Toyota_Corolla')
    })
  })

  describe('Error Handling', () => {
    test('should handle AbortController signal', async () => {
      const controller = new AbortController()

      ;(global.fetch as jest.Mock).mockImplementationOnce(() => {
        controller.abort()
        return Promise.reject(new Error('Aborted'))
      })

      const options: ImageDownloadOptions = {
        imageUrls: ['https://example.com/image.jpg'],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.errors.length).toBe(1)
      expect(result.filesDownloaded).toBe(0)
    })

    test('should handle malformed URLs', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Invalid URL'))

      const options: ImageDownloadOptions = {
        imageUrls: ['not-a-valid-url'],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.errors.length).toBe(1)
    })

    test('should continue processing after individual failures', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
        })
        .mockRejectedValueOnce(new Error('Failed'))

      const options: ImageDownloadOptions = {
        imageUrls: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg',
        ],
        filenamePrefix: 'test_car',
      }

      const result = await downloadCarImages(options)

      expect(result.filesDownloaded).toBe(1)
      expect(result.errors.length).toBe(2)
    })
  })

  describe('Integration', () => {
    test('should handle full workflow for car with multiple images', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })

      ;(global.fetch as jest.Mock)
        .mockResolvedValue({
          ok: true,
          blob: async () => mockBlob,
        })

      const onProgress = jest.fn()
      const onError = jest.fn()

      const options: ImageDownloadOptions = {
        imageUrls: [
          'https://example.com/car1.jpg',
          'https://example.com/car2.jpg',
          'https://example.com/car3.jpg',
        ],
        filenamePrefix: '2020_Toyota_Corolla',
        onProgress,
        onError,
      }

      const result = await downloadCarImages(options)

      expect(result.filesDownloaded).toBe(3)
      expect(result.totalFiles).toBe(3)
      expect(result.success).toBe(true)
      expect(onProgress).toHaveBeenCalledTimes(3)
      expect(onError).not.toHaveBeenCalled()
    })
  })
})
