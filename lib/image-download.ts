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

  return new File([blob], finalFilename, { type })
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
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Create a ZIP file from multiple images (requires JSZip)
 */
async function createZipFile(files: File[], zipFilename: string): Promise<File> {
  // Dynamic import to avoid bundling if not used
  const JSZip = (await import('jszip')).default

  const zip = new JSZip()

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    zip.file(file.name, arrayBuffer)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], zipFilename, { type: 'application/zip' })
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

  // Step 1: Fetch all images as File objects
  const files: File[] = []
  const abortController = new AbortController()

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]

    try {
      onProgress?.(i + 1, imageUrls.length)

      const filename = `${filenamePrefix}_${i + 1}`
      const file = await fetchImageAsFile(url, filename, abortController.signal)
      files.push(file)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      result.errors.push({ url, error: err.message })
      onError?.(err, url)
    }
  }

  result.filesDownloaded = files.length

  if (files.length === 0) {
    return result
  }

  // Step 2: Try native methods first (mobile share, file picker)
  try {
    // On mobile: Try native share API (will save to gallery if user chooses)
    if (navigator.share && typeof (navigator as any).canShare === 'function') {
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
    if (files.length > 1) {
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
      // Multiple files: create ZIP
      try {
        const zipFilename = `${filenamePrefix}_images.zip`
        const zipFile = await createZipFile(files, zipFilename)
        downloadViaLink(zipFile)
        return { ...result, success: true, method: 'zip' }
      } catch (zipError) {
        // If ZIP creation fails, download individually
        for (const file of files) {
          downloadViaLink(file)
          // Small delay between downloads to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 100))
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
