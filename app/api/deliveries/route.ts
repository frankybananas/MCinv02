import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Delivery from '@/models/Delivery'
import User from '@/models/User'
import Car from '@/models/Car'

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
    if (!phone) {
      const phoneHeader = request.headers.get('x-user-phone') || undefined
      if (!phoneHeader) return null
      await connectDb()
      const user2 = await (User as any).findOne({ phone: phoneHeader }).select('_id')
      return user2?._id?.toString() || null
    }
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
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') || ''
    const headersList = await headers()
    const role = String(headersList.get('x-user-role') || '')
    await connectDb()
    if (scope === 'recon') {
      const allowed = role === 'admin' || role === 'manager' || role === 'recon'
      if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      const items = await Delivery
        .find({
          status: 'active',
          $or: [
            { reconTasks: { $exists: true, $ne: [] } },
            { deliveryDate: { $ne: null } },
          ],
        })
        .populate({ path: 'car', populate: { path: 'images' } })
        .populate('client')
        .sort({ deliveryDate: 1, updatedAt: -1 })
      return NextResponse.json({ success: true, data: items })
    }
    const items = await Delivery
      .find({ salesperson: userId })
      .populate({ path: 'car', populate: { path: 'images' } })
      .populate('client')
      .sort({ updatedAt: -1 })
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
    const headersList = await headers()
    const userPhone = headersList.get('x-user-phone')
    const userName = headersList.get('x-user-name')
    // Resolve a human-friendly car label for the audit log
    let carLabel = `car '${carId}'`
    try {
      const car: any = await (Car as any).findById(carId).select('make model year licensePlate vin')
      if (car) {
        const parts: string[] = []
        if (car.make) parts.push(String(car.make))
        if (car.model) parts.push(String(car.model))
        if (car.year) parts.push(String(car.year))
        const base = parts.join(' ')
        const idents: string[] = []
        if (car.licensePlate) idents.push(`plate ${car.licensePlate}`)
        if (car.vin) idents.push(`VIN ${car.vin}`)
        carLabel = base ? `${base}${idents.length ? ` (${idents.join(', ')})` : ''}` : carLabel
      }
    } catch {}
    const item = await Delivery.findOneAndUpdate(
      { car: carId, salesperson: userId },
      {
        $setOnInsert: { car: carId, salesperson: userId },
        $push: {
          auditLog: {
            action: 'Delivery Created/Upserted',
            user: userName || userPhone || 'unknown',
            timestamp: new Date(),
            details: `Delivery record created or linked for ${carLabel}`
          }
        }
      },
      { new: true, upsert: true }
    )
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
