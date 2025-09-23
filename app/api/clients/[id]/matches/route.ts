import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Client from '@/models/Client'
import Match from '@/models/Match'
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

async function getPhoneAndRoleFromRequest(request: Request): Promise<{ phone: string | null; role: string | null }> {
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

export async function GET(request: Request, ctx: { params: { id: string } }) {
  await request.clone().blob()
  const { id } = await (ctx as any).params
  const clientId = id
  try {
    const { phone, role } = await getPhoneAndRoleFromRequest(request)
    if (!phone) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await connectDb()
    const client = await Client.findById(clientId)
    if (!client) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })

    const isPrivileged = role === 'admin' || role === 'manager'
    if (!isPrivileged && String(client.createdByPhone) !== String(phone)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // If matching is disabled for this user (and not privileged), return empty list
    if (!isPrivileged) {
      const currentUser = await User.findOne({ phone })
      if (currentUser && currentUser.matchingEnabled === false) {
        return NextResponse.json({ success: true, data: [] })
      }
    }

    const query: any = { client: clientId }
    if (!isPrivileged) query.createdByPhone = String(client.createdByPhone || phone)

    const matches = await (Match as any)
      .find(query)
      .select('car client score explanation status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'car', select: 'make model year images price kilometers status', populate: { path: 'images', select: 'imageUrl' } })

    return NextResponse.json({ success: true, data: matches })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
