import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import User from '@/models/User'
import { getSession } from '@/lib/auth-session'

export async function PUT(request: Request) {
  try {
    const session = await getSession(request)
    const phone = session?.phone
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const done = typeof body?.done === 'boolean' ? body.done : true
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    await connectDb()

    const update = done
      ? { $addToSet: { notificationsDoneIds: id } }
      : { $pull: { notificationsDoneIds: id } }

    const user = await User.findOneAndUpdate({ phone }, update, { new: true }).select('notificationsDoneIds')
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { notificationsDoneIds: user.notificationsDoneIds ?? [] } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
