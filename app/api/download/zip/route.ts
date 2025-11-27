import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { requireSession } from '@/lib/auth-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ZipRequestBody {
  urls: string[]
  filenamePrefix?: string
}

export async function POST(request: Request) {
  try {
    await requireSession(request)
    const body = (await request.json()) as ZipRequestBody
    const { urls, filenamePrefix = 'images' } = body || {}

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'No URLs provided' }, { status: 400 })
    }

    const zip = new JSZip()

    let index = 0
    for (const url of urls) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
        const blob = await resp.blob()
        const type = blob.type || 'image/jpeg'
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
        const name = `${filenamePrefix}_${++index}.${ext}`
        const arrayBuf = await blob.arrayBuffer()
        zip.file(name, arrayBuf)
      } catch (err) {
        // Skip failed file; continue with others
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipFileName = `${filenamePrefix}_images.zip`

    return new Response(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
