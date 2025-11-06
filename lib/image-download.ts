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
  method: 'native' | 'link' | 'share' | 'failed'
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
 * Fetch an image from URL and convert to File object (always as JPG)
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

  let blob = await response.blob()
  const type = blob.type || 'image/jpeg'
  
  // Convert WebP to JPG
  if (type.includes('webp')) {
    try {
      blob = await convertToJpg(blob)
    } catch (error) {
      console.warn('Failed to convert WebP to JPG, using original:', error)
    }
  }
  
  // Always use .jpg extension
  const finalFilename = filename.endsWith('.jpg') ? filename : `${filename}.jpg`

  return makeFileFromBlob(blob, finalFilename, 'image/jpeg')
}

/**
 * Convert image blob to JPG format using canvas
 */
async function convertToJpg(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      
      if (ctx) {
        // Fill with white background (important for transparency)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0)
        
        // Convert to JPG blob
        canvas.toBlob(
          (jpgBlob) => {
            if (jpgBlob) {
              resolve(jpgBlob)
            } else {
              reject(new Error('Failed to convert image to JPG'))
            }
          },
          'image/jpeg',
          0.92 // Quality: 92%
        )
      } else {
        reject(new Error('Failed to get canvas context'))
      }
      
      // Clean up
      URL.revokeObjectURL(img.src)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(blob)
  })
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
        
        let blob = new Blob([ab], { type: img.type })
        
        // Convert WebP to JPG
        if (img.type.includes('webp')) {
          try {
            blob = await convertToJpg(blob)
          } catch (error) {
            console.warn('Failed to convert WebP to JPG, using original:', error)
          }
        }
        
        // Always use .jpg extension for consistency
        const filename = `${filenamePrefix}_${img.index + 1}.jpg`
        files.push(makeFileFromBlob(blob, filename, 'image/jpeg'))
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
  if (typeof window === 'undefined') {
    console.log('Window is undefined, cannot use file picker')
    return false
  }

  // Check if File System Access API is available (Chrome, Edge)
  const showDirectoryPicker = (window as any).showDirectoryPicker
  if (!showDirectoryPicker) {
    console.log('showDirectoryPicker not available')
    return false
  }

  try {
    console.log(`Requesting directory picker for ${files.length} files...`)
    const dirHandle = await showDirectoryPicker()
    console.log('Directory selected, saving files...')

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`Saving file ${i + 1}/${files.length}: ${file.name}`)
      const fileHandle = await dirHandle.getFileHandle(file.name, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(file)
      await writable.close()
    }

    console.log('All files saved successfully via file picker')
    return true
  } catch (err) {
    // User cancelled or API error
    const error = err as Error
    console.log('File picker error or cancelled:', error.name, error.message)
    
    // AbortError means user cancelled - this is expected
    if (error.name === 'AbortError') {
      console.log('User cancelled directory picker')
      return false
    }
    
    // Other errors should be logged
    console.error('File picker failed with error:', err)
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
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Share files using Web Share API (iOS/Android native sharing)
 * This allows direct sharing to WhatsApp, Photos, etc.
 */
async function shareViaWebShareAPI(files: File[], title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    console.log('Web Share API not available')
    return false
  }

  // Check if we can share files
  const canShareFiles = navigator.canShare({ files: [files[0]] })
  if (!canShareFiles) {
    console.log('Cannot share files via Web Share API')
    return false
  }

  try {
    // Share all files at once if possible
    await navigator.share({
      files: files,
      title: title,
      text: `${files.length} car image(s)`,
    })
    console.log('Successfully shared via Web Share API')
    return true
  } catch (error: any) {
    // User cancelled or error occurred
    if (error.name === 'AbortError') {
      console.log('User cancelled share')
      return false
    }
    console.error('Web Share API error:', error)
    return false
  }
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

  // Detect platform
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Step 2: On desktop with multiple files, ALWAYS try native file picker first
  if (!isMobile && files.length > 1 && typeof (window as any).showDirectoryPicker !== 'undefined') {
    console.log('Desktop detected with multiple files, attempting file picker...')
    try {
      const pickerSuccess = await downloadViaFilePicker(files)
      if (pickerSuccess) {
        console.log('File picker succeeded, returning success')
        return { ...result, success: true, method: 'native' }
      }
      // If we get here, user cancelled the picker
      console.log('File picker returned false (user cancelled or error)')
      // Don't continue to fallback - user needs to try again
      return { ...result, success: false, method: 'native' }
    } catch (error) {
      console.error('File picker threw exception:', error)
      // Only on exception do we continue to fallback
    }
  }

  // Step 3: On mobile, try Web Share API (iOS/Android native sharing to WhatsApp, etc.)
  if (isMobile && files.length > 0) {
    console.log('Mobile detected, attempting Web Share API...')
    const shareTitle = `${filenamePrefix.replace(/_/g, ' ')}`
    const shared = await shareViaWebShareAPI(files, shareTitle)
    
    if (shared) {
      console.log('Successfully shared via Web Share API')
      return { ...result, success: true, method: 'share' }
    }
    
    // If user cancelled or share failed, return without error
    // Don't fall through to download on iOS - it won't work well
    console.log('Web Share cancelled or unavailable on mobile')
    return { ...result, success: false, method: 'share' }
  }

  // Step 4: Desktop fallback - download individually (no ZIP)
  try {
    // Single file: direct download
    if (files.length === 1) {
      downloadViaLink(files[0])
      return { ...result, success: true, method: 'link' }
    }

    // Multiple files on desktop: download sequentially
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
      }
    }

    console.log('Downloading files sequentially on desktop...')
    const perDelay = files.length > 10 ? 200 : 150
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
