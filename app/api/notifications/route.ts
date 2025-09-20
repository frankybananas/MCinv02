import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import User from '@/models/User'
import Car from '@/models/Car'
import Delivery from '@/models/Delivery'

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function getSessionInfo(request: Request): Promise<{ userId: string | null; phone: string | null }>{
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = parseCookie(cookieHeader, 'session_token')
    const jwtSecret = process.env.JWT_SECRET
    if (!token || !jwtSecret) return { userId: null, phone: null }
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    let userId: any = (payload as any).userId
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
      if (!(typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId))) {
        userId = null
      }
    } else {
      userId = null
    }
    const phone = (payload as any).phone as string | undefined
    return { userId, phone: phone || null }
  } catch {
    return { userId: null, phone: null }
  }
}

export async function GET(request: Request) {
  try {
    const { userId, phone } = await getSessionInfo(request)
    if (!phone) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await connectDb()

    // Load user to get lastLogin; default to 72h window when absent
    const user = await (User as any).findOne({ phone }).select('_id lastLogin profile')
    const since = user?.lastLogin ? new Date(user.lastLogin) : new Date(Date.now() - 72 * 60 * 60 * 1000)

    const notifications: any[] = []

    // 1) New Cars added by anyone since last login
    try {
      const newCars: any[] = await (Car as any)
        .find({ createdAt: { $gt: since } })
        .select('make model year images createdAt price')
        .sort({ createdAt: -1 })
        .populate('images')

      for (const c of newCars) {
        const title = `${c.year ?? ''} ${c.make ?? ''} ${c.model ?? ''}`.trim()
        const imageUrl = Array.isArray(c.images) && c.images[0]?.imageUrl ? c.images[0].imageUrl : undefined
        notifications.push({
          _id: `car_new:${String(c._id)}`,
          type: 'car_new',
          title: title ? `New car added: ${title}` : 'New car added',
          description: typeof c.price === 'number' ? `Price: ZAR ${new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0 }).format(c.price)}` : undefined,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
          data: { carId: String(c._id), imageUrl },
        })
      }
    } catch (e) {
      // swallow car aggregation errors to avoid blocking
      console.warn('Notifications: car aggregation failed', (e as any)?.message)
    }

    // 2) Car status changes (reserved/sold) by anyone since last login
    try {
      const carsWithRecentLogs: any[] = await (Car as any)
        .find({ 'auditLog.timestamp': { $gt: since } })
        .select('make model year images auditLog createdAt updatedAt')
        .populate('images')

      for (const c of carsWithRecentLogs) {
        const title = `${c.year ?? ''} ${c.make ?? ''} ${c.model ?? ''}`.trim() || 'Vehicle'
        const imageUrl = Array.isArray(c.images) && c.images[0]?.imageUrl ? c.images[0].imageUrl : undefined
        const entries: any[] = Array.isArray(c.auditLog) ? c.auditLog : []
        for (const entry of entries) {
          const t = new Date(entry.timestamp || c.updatedAt || c.createdAt).getTime()
          if (t <= since.getTime()) continue
          const details = String(entry.details || '').toLowerCase()
          if (String(entry.action || '').toLowerCase().includes('car status update')) {
            if (details.includes("to 'reserved'") || details.includes('to "reserved"') || details.includes('to reserved')) {
              notifications.push({
                _id: `car_reserved:${String(c._id)}:${String(t)}`,
                type: 'car_reserved',
                title: `Car reserved: ${title}`,
                description: entry.details || 'Car status changed to reserved',
                createdAt: new Date(t).toISOString(),
                data: { carId: String(c._id), imageUrl },
              })
            }
            if (details.includes("to 'sold'") || details.includes('to "sold"') || details.includes('to sold')) {
              notifications.push({
                _id: `car_sold:${String(c._id)}:${String(t)}`,
                type: 'car_sold',
                title: `Car sold: ${title}`,
                description: entry.details || 'Car status changed to sold',
                createdAt: new Date(t).toISOString(),
                data: { carId: String(c._id), imageUrl },
              })
            }
          }
        }
      }
    } catch (e) {
      console.warn('Notifications: car status aggregation failed', (e as any)?.message)
    }

    // 3) Delivery updates for this salesperson
    if (userId) {
      try {
        const deliveries: any[] = await (Delivery as any)
          .find({ salesperson: userId })
          .select('car status deliveryDate auditLog updatedAt createdAt')
          .populate({ path: 'car', select: 'make model year images', populate: { path: 'images' } })
          .sort({ updatedAt: -1 })

        const now = Date.now()
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000

        for (const d of deliveries) {
          const car = d.car || {}
          const carTitle = `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.trim() || 'Vehicle'
          const imageUrl = Array.isArray(car.images) && car.images[0]?.imageUrl ? car.images[0].imageUrl : undefined

          // Audit log entries since 'since'
          const entries: any[] = Array.isArray(d.auditLog) ? d.auditLog : []
          for (const entry of entries) {
            const t = new Date(entry.timestamp || d.updatedAt || d.createdAt).getTime()
            if (t > since.getTime()) {
              notifications.push({
                _id: `delivery_update:${String(d._id)}:${String(t)}`,
                type: 'delivery_update',
                title: `Delivery update: ${carTitle}`,
                description: entry.details || entry.action || 'Delivery updated',
                createdAt: new Date(t).toISOString(),
                data: { deliveryId: String(d._id), imageUrl },
              })
            }
          }

          // Due soon reminder
          if (d.status === 'active' && d.deliveryDate) {
            const dt = new Date(d.deliveryDate).getTime()
            if (dt >= now && dt <= now + THREE_DAYS) {
              notifications.push({
                _id: `delivery_due_soon:${String(d._id)}:${String(dt)}`,
                type: 'delivery_due_soon',
                title: `Delivery due soon: ${carTitle}`,
                description: `Scheduled for ${new Date(dt).toLocaleString()}`,
                createdAt: new Date().toISOString(),
                data: { deliveryId: String(d._id), imageUrl },
              })
            }
          }

          // Completed since last login
          if (d.status === 'completed') {
            const t = new Date(d.updatedAt || d.createdAt).getTime()
            if (t > since.getTime()) {
              notifications.push({
                _id: `delivery_completed:${String(d._id)}:${String(t)}`,
                type: 'delivery_completed',
                title: `Delivery completed: ${carTitle}`,
                description: 'Delivery marked as completed',
                createdAt: new Date(t).toISOString(),
                data: { deliveryId: String(d._id), imageUrl },
              })
            }
          }
        }
      } catch (e) {
        console.warn('Notifications: delivery aggregation failed', (e as any)?.message)
      }
    }

    // Sort DESC by createdAt and limit
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const limited = notifications.slice(0, 50)

    return NextResponse.json({ success: true, data: limited })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
