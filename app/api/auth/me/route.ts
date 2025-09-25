import { NextResponse } from 'next/server'
import User, { type IUser } from '@/models/User'
import { connect as connectDb } from '@/lib/mongodb'
import { requireSession } from '@/lib/auth-session'
import { formatHttpError, isHttpError, NotFoundError } from '@/lib/errors'
import type { HydratedDocument } from 'mongoose'

type UserDoc = HydratedDocument<IUser>

function serializeUser(user: UserDoc) {
  const profile = user.profile || {}
  return {
    phone: user.phone,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    avatar: profile.avatar || '',
    role: user.role,
    notificationsLastSeenAt: user.notificationsLastSeenAt || null,
    todoEnabled: user.todoEnabled === true,
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession(request)
    const phoneFromSession = session.phone

    const body = await request.json()
    const { firstName, lastName, email, avatar, phone } = (body ?? {}) as {
      firstName?: unknown
      lastName?: unknown
      email?: unknown
      avatar?: unknown
      phone?: unknown
    }

    await connectDb()
    const user = await User.findOne({ phone: phoneFromSession }) as UserDoc | null
    if (!user) {
      throw new NotFoundError('User not found')
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

    const data = serializeUser(user)

    return NextResponse.json({ success: true, data, requireReauth })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    const phone = session.phone

    await connectDb()
    const user = await User.findOne({ phone }) as UserDoc | null
    if (!user) {
      throw new NotFoundError('User not found')
    }

    const data = serializeUser(user)

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
