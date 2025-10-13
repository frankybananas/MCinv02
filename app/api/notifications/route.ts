import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import User, { type IUser } from '@/models/User'
import Car from '@/models/Car'
import Delivery from '@/models/Delivery'
import Todo from '@/models/Todo'
import { getSession } from '@/lib/auth-session'
import type { NotificationItem } from '@/app/types'
import type { HydratedDocument, Types } from 'mongoose'

type UserDoc = HydratedDocument<IUser>

interface PopulatedImage {
  imageUrl?: string
}

interface CarAuditEntry {
  action?: string
  details?: string
  timestamp?: Date
}

interface CarShape {
  _id: Types.ObjectId
  make?: string
  model?: string
  year?: number
  price?: number
  images?: PopulatedImage[]
  createdAt?: Date
  updatedAt?: Date
  auditLog?: CarAuditEntry[]
}

type CarDoc = HydratedDocument<CarShape>

interface DeliveryAuditEntry {
  action?: string
  details?: string
  timestamp?: Date
}

interface DeliveryShape {
  _id: Types.ObjectId
  status?: string
  deliveryDate?: Date
  updatedAt?: Date
  createdAt?: Date
  auditLog?: DeliveryAuditEntry[]
  car?: CarDoc | null
}

type DeliveryDoc = HydratedDocument<DeliveryShape>

function safeTitle(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (typeof part === 'number' ? String(part) : part ?? ''))
    .filter((value) => value !== '')
    .join(' ')
    .trim()
}

function firstImageUrl(images: PopulatedImage[] | undefined): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined
  const url = images[0]?.imageUrl
  return typeof url === 'string' && url.trim().length > 0 ? url : undefined
}

function formatPriceZar(price: number | undefined): string | undefined {
  if (typeof price !== 'number' || Number.isNaN(price)) return undefined
  return `Price: ZAR ${new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0 }).format(price)}`
}

function toIso(date: Date | string | undefined | null): string {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
  }
  if (typeof date === 'string') {
    const parsed = new Date(date)
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
  }
  return new Date().toISOString()
}

function isCarStatusUpdate(entry: CarAuditEntry | undefined, keyword: 'reserved' | 'sold'): boolean {
  if (!entry) return false
  const action = String(entry.action ?? '').toLowerCase()
  if (!action.includes('car status update')) return false
  const details = String(entry.details ?? '').toLowerCase()
  return details.includes(`to '${keyword}'`) || details.includes(`to "${keyword}"`) || details.includes(`to ${keyword}`)
}

function buildCarNotificationId(prefix: string, carId: Types.ObjectId, timestamp: number): string {
  return `${prefix}:${String(carId)}:${String(timestamp)}`
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session?.phone) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDb()

    const user = await User.findOne({ phone: session.phone }).select('_id lastLogin profile notificationsLastSeenAt') as UserDoc | null
    const since = user?.lastLogin ? new Date(user.lastLogin) : new Date(Date.now() - 72 * 60 * 60 * 1000)

    const notifications: NotificationItem[] = []

    // New cars since last login
    try {
      const newCars = await Car.find({ createdAt: { $gt: since } })
        .select('make model year images createdAt price')
        .sort({ createdAt: -1 })
        .populate('images') as unknown as CarDoc[]

      for (const car of newCars) {
        const title = safeTitle([car.year, car.make, car.model])
        const createdAtIso = toIso(car.createdAt)
        notifications.push({
          _id: `car_new:${String(car._id)}`,
          type: 'car_new',
          title: title ? `New car added: ${title}` : 'New car added',
          description: formatPriceZar(car.price),
          createdAt: createdAtIso,
          data: {
            carId: String(car._id),
            imageUrl: firstImageUrl(car.images),
          },
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Notifications: car aggregation failed', message)
    }

    // Car status updates
    try {
      const carsWithLogs = await Car.find({ 'auditLog.timestamp': { $gt: since } })
        .select('make model year images auditLog createdAt updatedAt')
        .populate('images') as unknown as CarDoc[]

      for (const car of carsWithLogs) {
        const title = safeTitle([car.year, car.make, car.model]) || 'Vehicle'
        const imageUrl = firstImageUrl(car.images)
        const auditEntries = Array.isArray(car.auditLog) ? car.auditLog : []

        for (const entry of auditEntries) {
          const timestamp = new Date(entry?.timestamp ?? car.updatedAt ?? car.createdAt ?? new Date()).getTime()
          if (!Number.isFinite(timestamp) || timestamp <= since.getTime()) continue

          if (isCarStatusUpdate(entry, 'reserved')) {
            notifications.push({
              _id: buildCarNotificationId('car_reserved', car._id, timestamp),
              type: 'car_reserved',
              title: `Car reserved: ${title}`,
              description: entry?.details || 'Car status changed to reserved',
              createdAt: new Date(timestamp).toISOString(),
              data: { carId: String(car._id), imageUrl },
            })
          }

          if (isCarStatusUpdate(entry, 'sold')) {
            notifications.push({
              _id: buildCarNotificationId('car_sold', car._id, timestamp),
              type: 'car_sold',
              title: `Car sold: ${title}`,
              description: entry?.details || 'Car status changed to sold',
              createdAt: new Date(timestamp).toISOString(),
              data: { carId: String(car._id), imageUrl },
            })
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Notifications: car status aggregation failed', message)
    }

    // Delivery updates for salesperson
    const userId = user?._id ? String(user._id) : null
    if (userId) {
      try {
        const deliveries = await Delivery.find({ salesperson: userId })
          .select('car status deliveryDate auditLog updatedAt createdAt')
          .populate({ path: 'car', select: 'make model year images', populate: { path: 'images' } })
          .sort({ updatedAt: -1 }) as unknown as DeliveryDoc[]

        const nowMs = Date.now()
        const threeDays = 3 * 24 * 60 * 60 * 1000

        for (const delivery of deliveries) {
          const car = delivery.car ?? null
          const carTitle = safeTitle([car?.year, car?.make, car?.model]) || 'Vehicle'
          const imageUrl = car ? firstImageUrl(car.images) : undefined
          const auditEntries = Array.isArray(delivery.auditLog) ? delivery.auditLog : []

          for (const entry of auditEntries) {
            const timestamp = new Date(entry?.timestamp ?? delivery.updatedAt ?? delivery.createdAt ?? new Date()).getTime()
            if (!Number.isFinite(timestamp) || timestamp <= since.getTime()) continue

            notifications.push({
              _id: `delivery_update:${String(delivery._id)}:${String(timestamp)}`,
              type: 'delivery_update',
              title: `Delivery update: ${carTitle}`,
              description: entry?.details || entry?.action || 'Delivery updated',
              createdAt: new Date(timestamp).toISOString(),
              data: { deliveryId: String(delivery._id), imageUrl },
            })
          }

          if (delivery.status === 'active' && delivery.deliveryDate) {
            const dueAt = new Date(delivery.deliveryDate).getTime()
            if (Number.isFinite(dueAt) && dueAt >= nowMs && dueAt <= nowMs + threeDays) {
              notifications.push({
                _id: `delivery_due_soon:${String(delivery._id)}:${String(dueAt)}`,
                type: 'delivery_due_soon',
                title: `Delivery due soon: ${carTitle}`,
                description: `Scheduled for ${new Date(dueAt).toLocaleString()}`,
                createdAt: new Date().toISOString(),
                data: { deliveryId: String(delivery._id), imageUrl },
              })
            }
          }

          if (delivery.status === 'completed') {
            const completedAt = new Date(delivery.updatedAt ?? delivery.createdAt ?? new Date()).getTime()
            if (Number.isFinite(completedAt) && completedAt > since.getTime()) {
              notifications.push({
                _id: `delivery_completed:${String(delivery._id)}:${String(completedAt)}`,
                type: 'delivery_completed',
                title: `Delivery completed: ${carTitle}`,
                description: 'Delivery marked as completed',
                createdAt: new Date(completedAt).toISOString(),
                data: { deliveryId: String(delivery._id), imageUrl },
              })
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('Notifications: delivery aggregation failed', message)
      }
    }

    // Upcoming TODO reminders (36 hours prior)
    if (userId) {
      try {
        const nowMs = Date.now()
        const reminderWindow = 36 * 60 * 60 * 1000
        const upcomingCutoff = new Date(nowMs + reminderWindow + 24 * 60 * 60 * 1000)
        const todos = await Todo.find({
          user: userId,
          date: { $lte: upcomingCutoff },
        })
          .select('title date time updatedAt createdAt')
          .sort({ date: 1, order: 1 })

        for (const todo of todos) {
          const baseDate = new Date(todo.date ?? new Date())
          if (Number.isNaN(baseDate.getTime())) continue
          if (typeof todo.time === 'string' && /^\d{2}:\d{2}$/.test(todo.time)) {
            const [hh, mm] = todo.time.split(':').map((part) => Number(part))
            baseDate.setHours(hh, mm, 0, 0)
          }
          const eventMs = baseDate.getTime()
          if (!Number.isFinite(eventMs)) continue
          if (eventMs <= nowMs) continue
          if (eventMs - nowMs > reminderWindow) continue

          const reminderId = `todo_reminder:${String(todo._id)}`
          if (notifications.some((n) => n._id === reminderId)) continue

          const reminderCreatedMs = Math.max(eventMs - reminderWindow, nowMs)
          const scheduledText = typeof todo.time === 'string'
            ? `${new Date(eventMs).toLocaleString()}`
            : `${new Date(eventMs).toLocaleDateString()}`

          notifications.push({
            _id: reminderId,
            type: 'todo_reminder',
            title: `Upcoming task: ${todo.title}`,
            description: `Happening ${scheduledText}`,
            createdAt: new Date(reminderCreatedMs).toISOString(),
            data: {
              clientId: undefined,
              matchId: undefined,
              todoId: String(todo._id),
            },
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('Notifications: todo reminders failed', message)
      }
    }

    // Exclude items the user marked as Done
    const doneIds = new Set<string>(Array.isArray((user as any)?.notificationsDoneIds) ? (user as any).notificationsDoneIds : [])
    const visible = notifications.filter(n => !doneIds.has(n._id))
    visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const limited = visible.slice(0, 50)

    return NextResponse.json({ success: true, data: limited })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
