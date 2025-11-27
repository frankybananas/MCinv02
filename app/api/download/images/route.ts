import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ImagesRequestBody {
  urls: string[]
}

/**
 * Server-side image proxy to bypass CORS restrictions.
 * Returns individual images as a JSON array of base64-encoded data URLs.
 */
export async function POST(request: Request) {
  try {
    await requireSession(request)
    const body = (await request.json()) as ImagesRequestBody
    const { urls } = body || {}

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'No URLs provided' }, { status: 400 })
    }

    const images: Array<{ data: string; type: string; index: number }> = []

    for (let i = 0; i < urls.length; i++) {
      try {
        const resp = await fetch(urls[i])
        if (!resp.ok) continue
        
        const blob = await resp.blob()
        const arrayBuf = await blob.arrayBuffer()
        const base64 = Buffer.from(arrayBuf).toString('base64')
        const type = blob.type || 'image/jpeg'
        
        images.push({
          data: `data:${type};base64,${base64}`,
          type,
          index: i,
        })
      } catch {
        // Skip failed images
      }
    }

    return NextResponse.json({ success: true, images })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
