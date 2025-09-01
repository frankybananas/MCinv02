import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Delivery from '@/models/Delivery'
import User from '@/models/User'
import '@/models/Car'

export const runtime = 'nodejs'

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie')
  const token = parseCookie(cookieHeader, 'session_token')
  const jwtSecret = process.env.JWT_SECRET
  if (!token || !jwtSecret) return null
  try {
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    let userId = (payload as any).userId as any
    if (typeof userId !== 'undefined') {
      if (typeof userId !== 'string') {
        try {
          if (userId?.data && Array.isArray(userId.data)) {
            userId = Buffer.from(userId.data).toString('utf8')
          } else if (ArrayBuffer.isView(userId)) {
            userId = Buffer.from(userId as Uint8Array).toString('utf8')
          } else if (typeof userId?.toString === 'function') {
            userId = userId.toString()
          }
        } catch {}
      }
      if (typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId)) {
        return userId
      }
    }
    const phone = (payload as any).phone as string | undefined
    if (!phone) return null
    await connectDb()
    const user = await (User as any).findOne({ phone }).select('_id')
    return user?._id?.toString() || null
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    await request.blob()
    const { id } = params
    await connectDb()
    const item = await Delivery.findOne({ _id: id, salesperson: userId })
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    console.error('GET /api/deliveries/[id] error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Server error', stack: err?.stack }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    await request.clone().blob()
    const { id } = params
    const body = await request.json()
    const { deliveryDate, financeBank, reconNotes, licensing, customerType, docs, status } = body || {}

    await connectDb()
    const update: any = {}
    if (deliveryDate !== undefined) update.deliveryDate = deliveryDate
    if (financeBank !== undefined) update.financeBank = financeBank
    if (reconNotes !== undefined) update.reconNotes = reconNotes
    if (licensing !== undefined) update.licensing = licensing
    if (customerType !== undefined) update.customerType = customerType
    if (status !== undefined) update.status = status
    if (Array.isArray(docs) && docs.length) {
      update.$push = { docs: { $each: docs } }
    }

    const item = await Delivery.findOneAndUpdate(
      { _id: id, salesperson: userId },
      update,
      { new: true }
    )
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
