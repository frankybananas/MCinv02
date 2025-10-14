/**
 * CarDetail Download Functionality Test Suite
 * 
 * Tests the download button and image download integration in CarDetail component.
 * Target Coverage: 80%+
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CarDetail } from '@/app/components/car-detail'
import type { Car } from '@/app/types'
import * as imageDownload from '@/lib/image-download'

// Mock the image download utility
jest.mock('@/lib/image-download', () => ({
  downloadCarImages: jest.fn(),
  downloadSingleImage: jest.fn(),
  hasNativeDownloadSupport: jest.fn(() => ({ share: false, filePicker: false })),
}))

// Mock fetch for dealer info
global.fetch = jest.fn()

describe('CarDetail Download Functionality', () => {
  const mockCar: Car = {
    _id: 'car123',
    year: 2020,
    make: 'Toyota',
    model: 'Corolla',
    price: 250000,
    kilometers: 50000,
    color: 'White',
    transmission: 'automatic',
    vin: 'ABC123XYZ456',
    notes: 'Well maintained',
    status: 'in-stock',
    createdAt: '2024-01-01T00:00:00.000Z',
    auditLog: [],
    images: [
      {
        _id: 'img1',
        imageUrl: 'https://example.com/image1.jpg',
        title: 'Front view',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 'img2',
        imageUrl: 'https://example.com/image2.jpg',
        title: 'Side view',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 'img3',
        imageUrl: 'https://example.com/image3.jpg',
        title: 'Interior',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ],
  }

  const mockProps = {
    car: mockCar,
    onBack: jest.fn(),
    onEdit: jest.fn(),
    onReserve: jest.fn(),
    onStatusChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock fetch for dealer info
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+27123456789',
          email: 'john@example.com',
        },
      }),
    })

    // Mock window.alert
    global.alert = jest.fn()
  })

  describe('Download Button', () => {
    test('should render download button', () => {
      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      expect(downloadButton).toBeInTheDocument()
    })

    test('should be enabled when car has images', () => {
      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      expect(downloadButton).not.toBeDisabled()
    })

    test('should be disabled when car has no images', () => {
      const carWithoutImages = { ...mockCar, images: [] }
      render(<CarDetail {...mockProps} car={carWithoutImages} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      expect(downloadButton).toBeDisabled()
    })

    test('should show download icon', () => {
      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      const icon = downloadButton.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Download Functionality', () => {
    test('should call downloadCarImages when download button is clicked', async () => {
      const mockDownloadResult = {
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'link' as const,
      }

      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue(mockDownloadResult)

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(imageDownload.downloadCarImages).toHaveBeenCalledWith({
          imageUrls: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ],
          filenamePrefix: '2020_Toyota_Corolla',
          onProgress: expect.any(Function),
          onError: expect.any(Function),
        })
      })
    })

    test('should show progress during download', async () => {
      let progressCallback: ((current: number, total: number) => void) | undefined

      ;(imageDownload.downloadCarImages as jest.Mock).mockImplementation(async (options) => {
        progressCallback = options.onProgress
        
        // Simulate progress
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
          method: 'link' as const,
        }
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      // Button should show progress
      await waitFor(() => {
        expect(downloadButton.textContent).toMatch(/\d+\/\d+/)
      })
    })

    test('should disable button during download', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          filesDownloaded: 3,
          totalFiles: 3,
          errors: [],
          method: 'link' as const,
        }), 100))
      )

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      // Button should be disabled during download
      expect(downloadButton).toBeDisabled()
    })

    test('should show success alert on successful download', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'link',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Successfully downloaded 3 image')
        )
      })
    })

    test('should show success alert for native method', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'native',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Successfully shared')
        )
      })
    })

    test('should show success alert for ZIP download', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'zip',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('ZIP file')
        )
      })
    })

    test('should show partial success alert', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 2,
        totalFiles: 3,
        errors: [{ url: 'https://example.com/image3.jpg', error: 'Failed' }],
        method: 'link',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringMatching(/Downloaded 2 image.*1 failed/)
        )
      })
    })

    test('should show error alert on complete failure', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: false,
        filesDownloaded: 0,
        totalFiles: 3,
        errors: [
          { url: 'https://example.com/image1.jpg', error: 'Failed' },
          { url: 'https://example.com/image2.jpg', error: 'Failed' },
          { url: 'https://example.com/image3.jpg', error: 'Failed' },
        ],
        method: 'failed',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Failed to download images')
        )
      })
    })

    test('should handle exception errors', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      )

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('An error occurred')
        )
      })
    })
  })

  describe('Download with Progress Callback', () => {
    test('should call onProgress callback', async () => {
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
          method: 'link' as const,
        }
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(imageDownload.downloadCarImages).toHaveBeenCalled()
      })

      // Verify progress was tracked
      expect(progressCallback).toBeDefined()
    })

    test('should call onError callback for failed images', async () => {
      let errorCallback: ((error: Error, url: string) => void) | undefined

      ;(imageDownload.downloadCarImages as jest.Mock).mockImplementation(async (options) => {
        errorCallback = options.onError
        
        if (errorCallback) {
          errorCallback(new Error('Network error'), 'https://example.com/image1.jpg')
        }

        return {
          success: true,
          filesDownloaded: 2,
          totalFiles: 3,
          errors: [{ url: 'https://example.com/image1.jpg', error: 'Network error' }],
          method: 'link' as const,
        }
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(imageDownload.downloadCarImages).toHaveBeenCalled()
      })

      expect(errorCallback).toBeDefined()
    })
  })

  describe('Filename Generation', () => {
    test('should generate correct filename prefix', async () => {
      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'link',
      })

      render(<CarDetail {...mockProps} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(imageDownload.downloadCarImages).toHaveBeenCalledWith(
          expect.objectContaining({
            filenamePrefix: '2020_Toyota_Corolla',
          })
        )
      })
    })

    test('should handle car names with spaces', async () => {
      const carWithSpaces = {
        ...mockCar,
        make: 'Mercedes Benz',
        model: 'C Class',
      }

      ;(imageDownload.downloadCarImages as jest.Mock).mockResolvedValue({
        success: true,
        filesDownloaded: 3,
        totalFiles: 3,
        errors: [],
        method: 'link',
      })

      render(<CarDetail {...mockProps} car={carWithSpaces} />)
      
      const downloadButton = screen.getByRole('button', { name: /download/i })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(imageDownload.downloadCarImages).toHaveBeenCalledWith(
          expect.objectContaining({
            filenamePrefix: '2020_Mercedes_Benz_C_Class',
          })
        )
      })
    })
  })
})
