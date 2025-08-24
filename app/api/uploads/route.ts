import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '@/lib/s3'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'multipart/form-data required' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'file required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const bucket = process.env.R2_BUCKET as string | undefined
    const publicBase = process.env.R2_PUBLIC_URL as string | undefined
    if (!bucket || !publicBase) {
      return NextResponse.json({ success: false, error: 'R2 bucket/public URL not configured' }, { status: 500 })
    }

    const ext = file.name.split('.').pop() || ''
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

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
