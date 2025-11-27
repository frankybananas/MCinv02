import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { connect as connectDb } from '@/lib/mongodb'
import Delivery from '@/models/Delivery'
import User from '@/models/User'
import Car from '@/models/Car'
import { requireSession, verifyActiveSession } from '@/lib/auth-session'

export const runtime = 'nodejs'

async function getUserIdFromSession(session: { userId: string | null; phone: string }): Promise<string | null> {
  if (session.userId && typeof session.userId === 'string' && /^[a-fA-F0-9]{24}$/.test(session.userId)) {
    return session.userId
  }
  if (session.phone) {
    await connectDb()
    const user = await (User as any).findOne({ phone: session.phone }).select('_id')
    return user?._id?.toString() || null
  }
  return null
}

// GET /api/deliveries -> current user's deliveries
export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    const userId = await getUserIdFromSession(session)
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
    const session = await requireSession(request)
    await verifyActiveSession(session)
    const userId = await getUserIdFromSession(session)
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
