/**
 * Image Download Utility
 * 
 * Provides robust functionality for downloading car images to local device.
 * Supports both mobile (save to gallery) and desktop (save to downloads folder).
 * 
 * Features:
 * - Batch image downloading with progress tracking
 * - Multiple fallback strategies for different platforms
 * - Error handling and retry logic
 * - ZIP file creation for batch downloads
 */

export interface ImageDownloadOptions {
  /**
   * Array of image URLs to download
   */
  imageUrls: string[]

  /**
   * Base filename prefix (e.g., "Toyota_Corolla_2020")
   */
  filenamePrefix: string

  /**
   * Optional callback for progress updates
   */
  onProgress?: (current: number, total: number) => void

  /**
   * Optional callback for errors
   */
  onError?: (error: Error, url: string) => void
}

export interface DownloadResult {
  success: boolean
  filesDownloaded: number
  totalFiles: number
  errors: Array<{ url: string; error: string }>
  method: 'native' | 'link' | 'zip' | 'failed'
}

function makeFileFromBlob(blob: Blob, filename: string, type: string): File {
  try {
    return new File([blob], filename, { type })
  } catch {
    const wrapped = new Blob([blob], { type }) as any
    try {
      Object.defineProperty(wrapped, 'name', { value: filename, configurable: true })
    } catch {
      ;(wrapped as any).name = filename
    }
    return wrapped as File
  }
}

/**
 * Fetch an image from URL and convert to File object
 */
async function fetchImageAsFile(
  url: string,
  filename: string,
  signal?: AbortSignal
): Promise<File> {
  const response = await fetch(url, {
    mode: 'cors',
    cache: 'force-cache',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }

  const blob = await response.blob()
  const type = blob.type || 'image/jpeg'
  
  // Ensure proper file extension
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`

  return makeFileFromBlob(blob, finalFilename, type)
}

/**
 * Fetch multiple images via server proxy to bypass CORS
 */
async function fetchImagesViaProxy(
  urls: string[],
  filenamePrefix: string
): Promise<File[]> {
  if (urls.length === 0) return []
  try {
    const resp = await fetch('/api/download/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })

    if (!resp.ok) return []

    const data = await resp.json()
    const files: File[] = []
    if (data?.success && Array.isArray(data.images)) {
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i]
        const dataUrl: string = img.data
        const base64 = dataUrl.split(',')[1]
        const byteString = atob(base64)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let j = 0; j < byteString.length; j++) {
          ia[j] = byteString.charCodeAt(j)
        }
        const blob = new Blob([ab], { type: img.type })
        const ext = img.type.includes('png') ? 'png' : img.type.includes('webp') ? 'webp' : 'jpg'
        const filename = `${filenamePrefix}_${img.index + 1}.${ext}`
        files.push(makeFileFromBlob(blob, filename, img.type))
      }
    }
    return files
  } catch {
    return []
  }
}

/**
 * Download images using native file picker (best for desktop)
 */
async function downloadViaFilePicker(files: File[]): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Check if File System Access API is available (Chrome, Edge)
  const showDirectoryPicker = (window as any).showDirectoryPicker
  if (!showDirectoryPicker) return false

  try {
    const dirHandle = await showDirectoryPicker()

    for (const file of files) {
      const fileHandle = await dirHandle.getFileHandle(file.name, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(file)
      await writable.close()
    }

    return true
  } catch (err) {
    // User cancelled or API not supported
    return false
  }
}

/**
 * Download images using anchor tag click method (works on all browsers)
 */
function downloadViaLink(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL after a delay
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const revokeDelay = isMobile ? 30000 : 5000
  setTimeout(() => URL.revokeObjectURL(url), revokeDelay)
}

/**
 * Create a ZIP file from multiple images (requires JSZip)
 */
async function createZipFile(files: File[], zipFilename: string): Promise<File> {
  const jszipModule = await import('jszip') as any
  const JSZip = jszipModule.default || jszipModule
  const zip = new JSZip()
  const folder = zip.folder('car_images') || zip

  files.forEach((file) => {
    folder.file(file.name, file)
  })

  const content = await zip.generateAsync({ type: 'blob' })
  return new File([content], zipFilename, { type: 'application/zip' })
}


/**
 * Main function to download all images from a car
 */
export async function downloadCarImages(
  options: ImageDownloadOptions
): Promise<DownloadResult> {
  const { imageUrls, filenamePrefix, onProgress, onError } = options

  const result: DownloadResult = {
    success: false,
    filesDownloaded: 0,
    totalFiles: imageUrls.length,
    errors: [],
    method: 'failed',
  }

  if (imageUrls.length === 0) {
    return { ...result, success: true, method: 'native' }
  }

  // Step 1: Fetch all images via server proxy to avoid CORS issues
  // The R2 bucket has CORS restrictions, so we use the server-side proxy
  // which can fetch images without CORS limitations
  const files: File[] = []
  const abortController = new AbortController()

  try {
    // First attempt: Use server proxy (most reliable, avoids CORS errors)
    const proxiedFiles = await fetchImagesViaProxy(imageUrls, filenamePrefix)
    
    if (proxiedFiles.length > 0) {
      files.push(...proxiedFiles)
      result.filesDownloaded = files.length
      
      // Update progress
      onProgress?.(files.length, imageUrls.length)
      
      // Clear errors if we got all files
      if (files.length === imageUrls.length) {
        result.errors = []
      } else {
        // Track which files failed
        const successCount = files.length
        for (let i = successCount; i < imageUrls.length; i++) {
          result.errors.push({ 
            url: imageUrls[i], 
            error: 'Failed to fetch via proxy' 
          })
        }
      }
    }
  } catch (proxyError) {
    console.warn('Server proxy failed, falling back to direct fetch:', proxyError)
    
    // Fallback: Try direct CORS fetch (may fail but worth trying)
    const isMobileUA = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const maxConcurrent = Math.max(1, Math.min(imageUrls.length, isMobileUA ? 4 : 6))

    let nextIndex = 0
    const worker = async () => {
      while (true) {
        const i = nextIndex++
        if (i >= imageUrls.length) break
        const url = imageUrls[i]
        try {
          const filename = `${filenamePrefix}_${i + 1}`
          const file = await fetchImageAsFile(url, filename, abortController.signal)
          files.push(file)
          onProgress?.(Math.min(files.length, imageUrls.length), imageUrls.length)
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          result.errors.push({ url, error: err.message })
          onError?.(err, url)
        }
      }
    }
    const workers = Array.from({ length: maxConcurrent }, () => worker())
    await Promise.all(workers)
    
    result.filesDownloaded = files.length
  }

  // If no files could be fetched at all, return failure
  if (files.length === 0) {
    return result
  }

  // Step 2: Try native methods first (file picker)
  try {
    // On desktop: Try file system access API (Chrome/Edge)
    if (files.length > 1 && typeof (window as any).showDirectoryPicker !== 'undefined') {
      const pickerSuccess = await downloadViaFilePicker(files)
      if (pickerSuccess) {
        return { ...result, success: true, method: 'native' }
      }
    }
  } catch (error) {
    // Continue to fallback methods
    console.warn('Native download methods failed:', error)
  }

  // Step 3: Fallback to link-based download
  try {
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    const recordDownloadError = (err: unknown, fileName: string) => {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error, fileName)
      result.errors.push({
        url: fileName,
        error: error.message || 'Download failed',
      })
    }

    const downloadSequentially = async (delay: number) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          downloadViaLink(file)
        } catch (err) {
          recordDownloadError(err, file.name)
        }
        await new Promise(resolve => setTimeout(resolve, delay))
        if (isMobile && (i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      }
    }

    if (files.length === 1) {
      downloadViaLink(files[0])
      return { ...result, success: true, method: 'link' }
    }

    if (!isMobile && files.length > 1) {
      try {
        const zipFilename = `${filenamePrefix}_images.zip`
        const zipFile = await createZipFile(files, zipFilename)
        downloadViaLink(zipFile)
        return { ...result, success: true, method: 'zip' }
      } catch (zipError) {
        const err = zipError instanceof Error ? zipError : new Error(String(zipError))
        console.warn('ZIP creation failed, falling back to individual downloads:', err)
        onError?.(err, 'zip')
      }
    }

    const perDelay = isMobile ? 800 : files.length > 10 ? 200 : 150
    await downloadSequentially(perDelay)
    return { ...result, success: true, method: 'link' }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err, 'Download failed')
    return result
  } finally {
    abortController.abort()
  }
}

/**
 * Simplified download function for single image
 */
export async function downloadSingleImage(
  imageUrl: string,
  filename: string
): Promise<boolean> {
  try {
    const file = await fetchImageAsFile(imageUrl, filename)
    downloadViaLink(file)
    return true
  } catch (error) {
    console.error('Failed to download image:', error)
    return false
  }
}

/**
 * Check if native download capabilities are available
 */
export function hasNativeDownloadSupport(): {
  share: boolean
  filePicker: boolean
} {
  if (typeof window === 'undefined') {
    return { share: false, filePicker: false }
  }

  return {
    share: 'share' in navigator,
    filePicker: 'showDirectoryPicker' in window,
  }
}

/**
 * Estimate total download size from image URLs
 */
export async function estimateDownloadSize(imageUrls: string[]): Promise<number> {
  if (!imageUrls.length) return 0

  try {
    // Sample first few images to estimate average size
    const sampleSize = Math.min(3, imageUrls.length)
    const sampleUrls = imageUrls.slice(0, sampleSize)
    
    const sizes = await Promise.all(
      sampleUrls.map(async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD' })
          const contentLength = response.headers.get('content-length')
          return contentLength ? parseInt(contentLength, 10) : 0
        } catch {
          return 0
        }
      })
    )

    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sampleSize
    return Math.ceil(avgSize * imageUrls.length)
  } catch {
    return 0
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
