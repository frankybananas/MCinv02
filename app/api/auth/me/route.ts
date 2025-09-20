import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import User from '@/models/User'
import { connect as connectDb } from '@/lib/mongodb'

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function PUT(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = parseCookie(cookieHeader, 'session_token')
    const jwtSecret = process.env.JWT_SECRET
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    const phoneFromSession = payload.phone as string | undefined
    if (!phoneFromSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, avatar, phone } = body || {}

    await connectDb()
    const user = await User.findOne({ phone: phoneFromSession })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    user.profile = {
      ...(user.profile || {}),
      firstName: typeof firstName === 'string' ? firstName : user.profile?.firstName,
      lastName: typeof lastName === 'string' ? lastName : user.profile?.lastName,
      email: typeof email === 'string' ? email : user.profile?.email,
      avatar: typeof avatar === 'string' ? avatar : user.profile?.avatar,
    }

    let requireReauth = false
    if (typeof phone === 'string' && phone && phone !== user.phone) {
      user.phone = phone
      requireReauth = true
    }

    await user.save()

    const profile = user.profile || {}
    const data = {
      phone: user.phone,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      avatar: profile.avatar || '',
      role: user.role,
      notificationsLastSeenAt: user.notificationsLastSeenAt || null,
    }

    return NextResponse.json({ success: true, data, requireReauth })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = parseCookie(cookieHeader, 'session_token')
    const jwtSecret = process.env.JWT_SECRET
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    const phone = payload.phone as string | undefined
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDb()
    const user = await User.findOne({ phone })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const profile = user.profile || {}
    const data = {
      phone: user.phone,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      avatar: profile.avatar || '',
      role: user.role,
      notificationsLastSeenAt: (user as any).notificationsLastSeenAt || null,
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
