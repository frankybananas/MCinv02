"use client"

export interface CompressOptions {
  maxDimension?: number
  qualityWebp?: number
  qualityJpeg?: number
  targetType?: 'image/webp' | 'image/jpeg'
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> => {
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), type, quality)
  })
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('compressImage must run in the browser')
  }

  const maxDimension = opts.maxDimension ?? 1920
  const prefersWebp = (opts.targetType ?? 'image/webp') === 'image/webp'
  let targetType: 'image/webp' | 'image/jpeg' = prefersWebp && supportsType('image/webp') ? 'image/webp' : 'image/jpeg'
  const qualityWebp = opts.qualityWebp ?? 0.8
  const qualityJpeg = opts.qualityJpeg ?? 0.85

  try {
    const bitmap = await createBitmap(file)
    const { width: w, height: h } = bitmap
    const scale = Math.min(1, maxDimension / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // Better rendering quality on some browsers
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap as any, 0, 0, tw, th)

    const blob = await toBlob(canvas, targetType, targetType === 'image/webp' ? qualityWebp : qualityJpeg)
    if (!blob) return file

    const ext = targetType === 'image/webp' ? 'webp' : 'jpg'
    const nameBase = file.name.replace(/\.[^.]+$/, '')
    const out = new File([blob], `${nameBase}.${ext}`, { type: targetType, lastModified: Date.now() })
    return out
  } catch {
    return file
  }
}

function supportsType(type: string): boolean {
  if (typeof document === 'undefined') return false
  const c = document.createElement('canvas')
  try {
    const data = c.toDataURL(type)
    return data.startsWith(`data:${type}`)
  } catch {
    return false
  }
}

async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // Prefer createImageBitmap which usually respects EXIF orientation
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file)
  }
  // Fallback to HTMLImageElement
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
