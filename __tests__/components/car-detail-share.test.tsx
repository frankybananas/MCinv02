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
const mockWindowOpen = jest.fn()
global.window.open = mockWindowOpen

// Mock global.alert
global.alert = jest.fn()

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

    // Should show success alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Downloaded 3 image(s)')
      )
    })

    // Should open WhatsApp with car details
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/?text='),
        '_blank'
      )
    })

    // Verify WhatsApp URL contains car details
    const whatsappUrl = mockWindowOpen.mock.calls[0][0] as string
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1])
    
    expect(decodedText).toContain('2024 BMW M3 Competition')
    expect(decodedText).toMatch(/Price: R\s*1[\s,]899[\s,]000/)
    expect(decodedText).toMatch(/Kilometers: 12[\s,]000 km/)
    expect(decodedText).toContain('Color: Grey')
    expect(decodedText).toContain('Transmission: automatic')
    // Should NOT contain download instruction
    expect(decodedText).not.toContain('Images downloaded to your device')
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

    // Should show failure alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download images')
      )
    })

    // Should still open WhatsApp
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/?text='),
        '_blank'
      )
    })
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

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0][0] as string
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1])
    
    // Should still contain car details
    expect(decodedText).toContain('2024 BMW M3 Competition')
    
    // Should not crash even without dealer info
    expect(decodedText).not.toContain('undefined')
    // Should not contain download instruction
    expect(decodedText).not.toContain('Images downloaded to your device')
  })

  test('should not include image URLs in main WhatsApp message', async () => {
    render(<CarDetail {...mockProps} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })

    const whatsappUrl = mockWindowOpen.mock.calls[0][0] as string
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1])
    
    // Should NOT contain image URLs (since images are downloaded)
    expect(decodedText).not.toContain('https://example.com/img1.jpg')
    expect(decodedText).not.toContain('Sample Photos:')
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

    const whatsappUrl = mockWindowOpen.mock.calls[0][0] as string
    const decodedText = decodeURIComponent(whatsappUrl.split('text=')[1])
    
    // Fallback should include image links
    expect(decodedText).toContain('Sample Photos:')
    expect(decodedText).toContain('https://example.com/img1.jpg')
  })

  test('should handle car with no images', async () => {
    const carWithoutImages = { ...mockCar, images: [] }
    
    render(<CarDetail {...mockProps} car={carWithoutImages} />)
    
    const shareButton = screen.getByRole('button', { name: /share/i })
    fireEvent.click(shareButton)

    // Should open WhatsApp with text only (no download attempt)
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/?text='),
        '_blank'
      )
    }, { timeout: 3000 })
    
    // Verify download was not called since there are no images
    expect(imageDownload.downloadCarImages).not.toHaveBeenCalled()
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
  })
})
