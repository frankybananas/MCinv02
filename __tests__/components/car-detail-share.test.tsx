import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CarDetail } from '@/app/components/car-detail'
import * as imageDownload from '@/lib/image-download'
import type { Car } from '@/app/types'

// Mock the image download module
jest.mock('@/lib/image-download', () => ({
  downloadCarImages: jest.fn(),
}))

// Mock window.open
const mockWindowOpen = jest.fn<Window | null, [string, string]>(() => ({
  closed: false,
  close: jest.fn(),
} as any))
global.window.open = mockWindowOpen as any

// Mock console methods
global.console.warn = jest.fn()
global.console.error = jest.fn()

const mockCar: Car = {
  _id: '1',
  make: 'BMW',
  model: 'M3 Competition',
  year: 2024,
  price: 1899000,
  kilometers: 12000,
  color: 'Grey',
  transmission: 'automatic',
  description: 'Stunning performance sedan',
  status: 'in-stock',
  images: [
    { imageUrl: 'https://example.com/img1.jpg', title: 'Image 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { imageUrl: 'https://example.com/img2.jpg', title: 'Image 2', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { imageUrl: 'https://example.com/img3.jpg', title: 'Image 3', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ],
  createdAt: '2024-01-01',
} as Car

const mockProps = {
  car: mockCar,
  onBack: jest.fn(),
  onEdit: jest.fn(),
  onReserve: jest.fn(),
  onStatusChange: jest.fn(),
}

describe('CarDetail Share Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWindowOpen.mockReturnValue({
      closed: false,
      close: jest.fn(),
    } as any)
    ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
      success: true,
      filesDownloaded: 3,
      totalFiles: 3,
      errors: [],
      method: 'link',
    })
  })

  test('should download images and open WhatsApp when Share button clicked', async () => {
    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Wait for download to complete
    await waitFor(() => {
      expect(imageDownload.downloadCarImages).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg', 'https://example.com/img3.jpg'],
          filenamePrefix: '2024_BMW_M3_Competition',
        })
      )
    })

    // Should open WhatsApp with proper URL
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringMatching(/^whatsapp:\/\/send\?text=/),
      '_blank'
    )
    
    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    
    // Decode and verify the message content
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    expect(decodedText).toContain('2024 BMW M3 Competition')
    expect(decodedText).toMatch(/Price:\s*R\s*1\s*899\s*000/)
    expect(decodedText).toMatch(/Kilometers:\s*12\s*000\s*km/)
    expect(decodedText).toContain('Color: Grey')
    expect(decodedText).toContain('Transmission: automatic')
  })

  test('should handle download failure gracefully', async () => {
    ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
      success: false,
      filesDownloaded: 0,
      totalFiles: 3,
      errors: [{ url: 'https://example.com/img1.jpg', error: 'Failed' }],
      method: 'failed',
    })

    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should log warning about download failure
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        'Image download failed:',
        expect.arrayContaining([{ url: 'https://example.com/img1.jpg', error: 'Failed' }])
      )
    })

    // Should still attempt to open WhatsApp (even if download failed)
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    expect(whatsappUrl).toMatch(/^whatsapp:\/\/send\?text=/)
  })

  test('should work without contact details when dealer info not loaded', async () => {
    // Mock the /api/auth/me endpoint to return empty
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should still open WhatsApp without contact info
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    
    // Should have car details but no contact section
    expect(decodedText).toContain('2024 BMW M3 Competition')
    expect(decodedText).not.toContain('Your Sales Contact:')
  })

  test('should not include image URLs in main WhatsApp message', async () => {
    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    
    // Should NOT include image URLs (images are downloaded separately)
    expect(decodedText).not.toContain('Sample Photos:')
    expect(decodedText).not.toContain('https://example.com/img1.jpg')
  })

  test('should fallback to image links if download throws error', async () => {
    ;(imageDownload.downloadCarImages as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should still open WhatsApp with fallback (image links)
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    
    // Fallback should include image links
    expect(decodedText).toContain('Sample Photos:')
    expect(decodedText).toContain('https://example.com/img1.jpg')
  })

  test('should handle car with no images', async () => {
    const carWithoutImages = { ...mockCar, images: [] }
    
    render(<CarDetail {...mockProps} car={carWithoutImages} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Verify download was not called since there are no images
    expect(imageDownload.downloadCarImages).not.toHaveBeenCalled()
    
    // Should still open WhatsApp with text
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    expect(whatsappUrl).toMatch(/^whatsapp:\/\/send\?text=/)
  })

  test('should show download progress while downloading', async () => {
    let progressCallback: ((current: number, total: number) => void) | undefined

    ;(imageDownload.downloadCarImages as jest.Mock).mockImplementation(async (options) => {
      progressCallback = options.onProgress
      if (progressCallback) {
        progressCallback(1, 3)
        progressCallback(2, 3)
        progressCallback(3, 3)
      }
      return {
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'link',
      }
    })

    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should show progress indicator
    await waitFor(() => {
      const progressText = screen.queryByText(/3\/3/)
      expect(progressText).toBeInTheDocument()
    })
    
    // Should eventually open WhatsApp
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })
  })

  test('should fallback to web WhatsApp if app URL fails to open', async () => {
    // Mock window.open to return null (blocked popup)
    mockWindowOpen.mockReturnValueOnce(null)

    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should try to open app URL first
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringMatching(/^whatsapp:\/\/send\?text=/),
        '_blank'
      )
    })

    // Should fallback to web WhatsApp after delay
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/wa\.me\/\?text=/),
        '_blank'
      )
    }, { timeout: 1000 })
  })

  test('should include contact details when dealer info is loaded', async () => {
    // Mock the /api/auth/me endpoint to return dealer info BEFORE rendering
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+27824544656',
          email: 'john@example.com',
        },
      }),
    })

    render(<CarDetail {...mockProps} />)
    
    // Wait for dealer info to load (useEffect completes)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me')
    })

    // Give extra time for state update
    await new Promise(resolve => setTimeout(resolve, 100))

    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    
    // Should include contact section
    expect(decodedText).toContain('Your Sales Contact:')
    expect(decodedText).toContain('Name: John Doe')
    expect(decodedText).toContain('Mobile: +27824544656')
    expect(decodedText).toContain('Email: john@example.com')
  })

  test('should include car description in WhatsApp message', async () => {
    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0]?.[0] as string
    expect(whatsappUrl).toBeDefined()
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1] || '')
    
    expect(decodedText).toContain('Stunning performance sedan')
  })
})
