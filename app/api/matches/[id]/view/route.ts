import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Match from '@/models/Match'

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function getSession(request: Request): Promise<{ phone: string | null; role: string | null }>{
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = parseCookie(cookieHeader, 'session_token')
    const jwtSecret = process.env.JWT_SECRET
    if (!token || !jwtSecret) return { phone: null, role: null }
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    const phone = (payload as any).phone as string | undefined
    const role = (payload as any).role as string | undefined
    return { phone: phone || null, role: role || null }
  } catch {
    return { phone: null, role: null }
  }
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  await request.clone().blob()
  const { id } = await (ctx as any).params
  const matchId = id
  try {
    const { phone, role } = await getSession(request)
    if (!phone) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await connectDb()
    const m: any = await Match.findById(matchId)
    if (!m) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 })

    const isPrivileged = role === 'admin' || role === 'manager'
    if (!isPrivileged && String(m.createdByPhone) !== String(phone)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    m.status = 'viewed'
    m.viewedAt = new Date()
    await m.save()

    return NextResponse.json({ success: true, data: { _id: String(m._id), status: m.status, viewedAt: m.viewedAt } })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
