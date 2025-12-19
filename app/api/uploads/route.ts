import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { requireSession, verifyActiveSession } from '@/lib/auth-session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    await verifyActiveSession(session)
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'multipart/form-data required' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'file required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const bucket = (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET) as string | undefined
    const publicBase = process.env.R2_PUBLIC_URL as string | undefined

    const ext = file.name.split('.').pop() || ''
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    if (!bucket || !publicBase) {
      // Fallback: save to local filesystem under public/uploads for dev
      try {
        const { promises: fsp } = await import('fs')
        const path = await import('path')
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
        await fsp.mkdir(uploadsDir, { recursive: true })
        const localPath = path.join(process.cwd(), 'public', key)
        const localDir = path.dirname(localPath)
        await fsp.mkdir(localDir, { recursive: true })
        await fsp.writeFile(localPath, buffer)
        const url = '/' + key
        return NextResponse.json({ success: true, data: { url, key, fileType: file.type, fileSize: file.size } })
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e?.message || 'Local upload failed' }, { status: 500 })
      }
    }

    // Cloudflare R2 path
    // Lazy-load S3 client only when this route is invoked
    const { s3 } = await import('@/lib/s3')

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ACL: 'public-read',
    } as any))

    const url = publicBase.replace(/\/$/, '') + '/' + key
    return NextResponse.json({ success: true, data: { url, key, fileType: file.type, fileSize: file.size } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Upload failed' }, { status: 500 })
  }
}
