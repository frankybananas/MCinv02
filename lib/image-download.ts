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
  const revokeDelay = isMobile ? 15000 : 3000
  setTimeout(() => URL.revokeObjectURL(url), revokeDelay)
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

  // Step 1: Fetch all images as File objects directly first
  const files: File[] = []
  const abortController = new AbortController()
  const failedDirect: Array<{ url: string; index: number }> = []

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]
    try {
      const filename = `${filenamePrefix}_${i + 1}`
      const file = await fetchImageAsFile(url, filename, abortController.signal)
      files.push(file)
      onProgress?.(Math.min(files.length, imageUrls.length), imageUrls.length)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      failedDirect.push({ url, index: i })
      result.errors.push({ url, error: err.message })
      onError?.(err, url)
    }
  }

  // Step 1b: Attempt to fetch any failed URLs via server proxy
  if (failedDirect.length > 0) {
    try {
      const proxiedFiles = await fetchImagesViaProxy(
        failedDirect.map(f => f.url),
        filenamePrefix
      )
      if (proxiedFiles.length > 0) {
        files.push(...proxiedFiles)
        onProgress?.(Math.min(files.length, imageUrls.length), imageUrls.length)
      }
    } catch {
      // ignore, errors already recorded above
    }
  }

  result.filesDownloaded = files.length

  // If no files could be fetched (safety net), fetch via server proxy
  if (files.length === 0 && imageUrls.length > 0) {
    try {
      const proxied = await fetchImagesViaProxy(imageUrls, filenamePrefix)
      files.push(...proxied)
      result.filesDownloaded = files.length
      if (proxied.length > 0) {
        // Clear accumulated errors on success
        result.errors = []
      }
    } catch (proxyErr) {
      console.warn('Server image proxy failed:', proxyErr)
    }
    
    if (files.length === 0) {
      return result
    }
  }

  // Step 2: Try native methods first (mobile share, file picker)
  try {
    // On mobile: Try native share API only for small batches (mobile has limits)
    const isMobileUA = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobileUA && navigator.share && typeof (navigator as any).canShare === 'function' && files.length <= 10) {
      const shareData: ShareData = {
        files,
        title: `${filenamePrefix} Images`,
      }

      if ((navigator as any).canShare(shareData)) {
        await navigator.share(shareData)
        return { ...result, success: true, method: 'native' }
      }
    }

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
    if (files.length === 1) {
      // Single file: direct download
      downloadViaLink(files[0])
      return { ...result, success: true, method: 'link' }
    } else {
      // For mobile or many files: download individually (better UX than ZIP on mobile)
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (isMobile || files.length > 10) {
        const perDelay = isMobile ? 600 : 200
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          downloadViaLink(file)
          await new Promise(resolve => setTimeout(resolve, perDelay))
          if (isMobile && (i + 1) % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1200))
          }
        }
        return { ...result, success: true, method: 'link' }
      } else {
        for (const file of files) {
          downloadViaLink(file)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        return { ...result, success: true, method: 'link' }
      }
    }
  } catch (error) {
    console.error('All download methods failed:', error)
  }

  return result
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

  const navAny = navigator as any

  return {
    share: !!(navAny?.share && typeof navAny.canShare === 'function'),
    filePicker: !!((window as any)?.showDirectoryPicker),
  }
}

/**
 * Estimate total download size from image URLs
 */
export async function estimateDownloadSize(imageUrls: string[]): Promise<number> {
  let totalSize = 0

  for (const url of imageUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'cors' })
      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        totalSize += parseInt(contentLength, 10)
      }
    } catch {
      // Ignore errors, just skip this file
    }
  }

  return totalSize
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
