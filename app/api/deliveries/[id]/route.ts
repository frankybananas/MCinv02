import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
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
    const { id } = await (params as any)
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
    const { id } = await (params as any)
    const headersList = await headers()
    const userPhone = headersList.get('x-user-phone')
    let userName = headersList.get('x-user-name')
    // If no name provided in headers, try to resolve from DB by phone
    if ((!userName || !userName.trim()) && userPhone) {
      try {
        await connectDb()
        const u: any = await (User as any).findOne({ phone: userPhone }).select('firstName lastName phone')
        if (u) {
          const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
          if (full) userName = full
        }
      } catch {}
    }
    const body = await request.json()
    const { deliveryDate, financeBank, reconNotes, reconTasks, licensing, customerType, docs, status, additionalDocs } = body || {}
    try {
      console.log('[DELIVERY_DEBUG] PUT /api/deliveries/[id] incoming id:', id)
      console.log('[DELIVERY_DEBUG] incoming reconTasks:', Array.isArray(reconTasks) ? reconTasks.length : reconTasks)
    } catch {}

    await connectDb()
    const update: any = {}
    // Load existing to compute audit details and allow partial merges
    const existing: any = await Delivery.findOne({ _id: id, salesperson: userId }).lean()
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (deliveryDate !== undefined) update.deliveryDate = deliveryDate
    if (financeBank !== undefined) update.financeBank = financeBank
    if (reconNotes !== undefined) update.reconNotes = reconNotes
    if (reconTasks !== undefined) update.reconTasks = reconTasks
    if (licensing !== undefined) update.licensing = licensing
    if (customerType !== undefined) update.customerType = customerType
    if (status !== undefined) update.status = status
    if (body.client !== undefined) update.client = body.client || null
    if (additionalDocs !== undefined) update.additionalDocs = additionalDocs
    if (Array.isArray(docs) && docs.length) {
      update.$push = { ...(update.$push || {}), docs: { $each: docs } }
    }

    // Build human-readable audit entry like Car audit log
    const changes: string[] = []
    const addFieldChange = (label: string, oldVal: any, newVal: any) => {
      const oldIsEmpty = oldVal == null || oldVal === ''
      const newIsEmpty = newVal == null || newVal === ''
      if (oldIsEmpty && newIsEmpty) return
      const same = (() => {
        try { return JSON.stringify(oldVal) === JSON.stringify(newVal) } catch { return oldVal === newVal }
      })()
      if (!same) {
        changes.push(`'${label}' from '${oldIsEmpty ? 'N/A' : String(oldVal)}' to '${newIsEmpty ? 'N/A' : String(newVal)}'`)
      }
    }
    if (typeof deliveryDate !== 'undefined') addFieldChange('deliveryDate', existing.deliveryDate, deliveryDate)
    if (typeof financeBank !== 'undefined') addFieldChange('financeBank', existing.financeBank, financeBank)
    if (typeof reconNotes !== 'undefined') addFieldChange('reconNotes', existing.reconNotes, reconNotes)
    if (typeof reconTasks !== 'undefined') {
      const same = (() => { try { return JSON.stringify(existing.reconTasks) === JSON.stringify(reconTasks) } catch { return false } })()
      if (!same) {
        const oldLen = Array.isArray(existing.reconTasks) ? existing.reconTasks.length : 0
        const newLen = Array.isArray(reconTasks) ? reconTasks.length : 0
        changes.push(`reconTasks were updated (count: ${oldLen} -> ${newLen})`)
      }
    }
    if (typeof licensing !== 'undefined') {
      const same = (() => { try { return JSON.stringify(existing.licensing) === JSON.stringify(licensing) } catch { return false } })()
      if (!same) changes.push('licensing was updated')
    }
    if (typeof customerType !== 'undefined') addFieldChange('customerType', existing.customerType, customerType)
    if (typeof status !== 'undefined') addFieldChange('status', existing.status, status)
    if (typeof body.client !== 'undefined') addFieldChange('client', existing.client, body.client)
    if (typeof additionalDocs !== 'undefined') {
      const prev = existing.additionalDocs || {}
      const curr = additionalDocs || {}
      const keys: Array<'trade_in_natis' | 'source_of_funds' | 'ubo_form'> = ['trade_in_natis','source_of_funds','ubo_form']
      const local: string[] = []
      for (const k of keys) {
        const a = !!(prev as any)[k]
        const b = !!(curr as any)[k]
        if (a !== b) local.push(`'${k}' from '${a ? 'Yes' : 'No'}' to '${b ? 'Yes' : 'No'}'`)
      }
      if (local.length) changes.push(`additionalDocs: ${local.join(', ')}`)
    }
    if (Array.isArray(docs) && docs.length) {
      changes.push(`docs were added: ${docs.map((d: any) => d.kind).join(', ')}`)
    }
    if (changes.length > 0) {
      const details = `Updated fields: ${changes.join(', ')}`
      const auditEntry = {
        action: 'Delivery Details Update',
        user: userName || userPhone || 'unknown',
        timestamp: new Date(),
        details,
      }
      update.$push = { ...(update.$push || {}), auditLog: auditEntry }
    }

    // If nothing to update (no field changes, no docs and no audit addition), avoid unnecessary write
    if (!Object.keys(update).length) {
      const existingItem = await Delivery.findOne({ _id: id, salesperson: userId })
      if (!existingItem) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      try {
        console.log('[DELIVERY_DEBUG] saved reconTasks length:', Array.isArray((existingItem as any)?.reconTasks) ? (existingItem as any).reconTasks.length : (existingItem as any)?.reconTasks)
      } catch {}
      return NextResponse.json({ success: true, data: existingItem })
    }

    const item = await Delivery.findOneAndUpdate(
      { _id: id, salesperson: userId },
      update,
      { new: true }
    )
    try {
      console.log('[DELIVERY_DEBUG] saved reconTasks length:', Array.isArray((item as any)?.reconTasks) ? (item as any).reconTasks.length : (item as any)?.reconTasks)
    } catch {}
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
