import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import User, { type IUser } from '@/models/User'
import { getSession } from '@/lib/auth-session'
import type { HydratedDocument } from 'mongoose'

type UserDoc = HydratedDocument<IUser>

function parseTimestamp(value: unknown): Date {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  return new Date()
}

export async function PUT(request: Request) {
  try {
    const session = await getSession(request)
    const phone = session?.phone
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDb()

    const body = await request.json().catch(() => ({ timestamp: new Date().toISOString() }))
    const timestampValue = typeof body === 'object' && body !== null && 'timestamp' in body ? (body as Record<string, unknown>).timestamp : undefined
    const when = parseTimestamp(timestampValue)

    const updated = await User.findOneAndUpdate({ phone }, { $set: { notificationsLastSeenAt: when } }, { new: true })
      .select('notificationsLastSeenAt')

    const data = updated ? { notificationsLastSeenAt: (updated as UserDoc).notificationsLastSeenAt ?? null } : { notificationsLastSeenAt: null }

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
