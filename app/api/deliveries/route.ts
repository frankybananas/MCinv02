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
      // Coerce Buffer/Uint8Array to string if needed
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

// GET /api/deliveries -> current user's deliveries
export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request)
    console.log('[DELIVERY_DEBUG] GET /api/deliveries - userId from JWT:', userId)
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    await connectDb()
    
    // Debug: Check all deliveries to see what's in the database
    const allDeliveries = await Delivery.find({}).select('salesperson car').lean()
    console.log('[DELIVERY_DEBUG] All deliveries in DB:', allDeliveries.map(d => ({ salesperson: d.salesperson, car: d.car })))
    
    const items = await Delivery
      .find({ salesperson: userId })
      .populate({ path: 'car', populate: { path: 'images' } })
      .populate('client')
      .sort({ updatedAt: -1 })
    console.log('[DELIVERY_DEBUG] Filtered deliveries for user:', items.length)
    try {
      console.log('[DELIVERY_DEBUG] reconTasks counts:', items.map((d:any)=>({id:d._id?.toString?.(), count: Array.isArray(d.reconTasks)? d.reconTasks.length : 0 })))
    } catch {}
    return NextResponse.json({ success: true, data: items })
  } catch (err: any) {
    console.error('GET /api/deliveries error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Server error', stack: err?.stack }, { status: 500 })
  }
}

// POST /api/deliveries -> upsert for carId
export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { carId } = body || {}
    if (!carId) return NextResponse.json({ success: false, error: 'carId required' }, { status: 400 })
    await connectDb()
    const item = await Delivery.findOneAndUpdate(
      { car: carId, salesperson: userId },
      { $setOnInsert: { car: carId, salesperson: userId } },
      { new: true, upsert: true }
    )
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
