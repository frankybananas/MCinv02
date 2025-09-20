import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import User from '@/models/User'

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function getPhoneFromRequest(request: Request): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = parseCookie(cookieHeader, 'session_token')
    const jwtSecret = process.env.JWT_SECRET
    if (!token || !jwtSecret) return null
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    const phone = (payload as any).phone as string | undefined
    return phone || null
  } catch {
    return null
  }
}

export async function PUT(request: Request) {
  try {
    const phone = await getPhoneFromRequest(request)
    if (!phone) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await connectDb()

    const { timestamp } = await request.json().catch(() => ({ timestamp: new Date().toISOString() }))
    const when = new Date(typeof timestamp === 'string' ? timestamp : Date.now())

    const updated = await (User as any).findOneAndUpdate(
      { phone },
      { $set: { notificationsLastSeenAt: when } },
      { new: true }
    ).select('notificationsLastSeenAt')

    return NextResponse.json({ success: true, data: { notificationsLastSeenAt: updated?.notificationsLastSeenAt } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
