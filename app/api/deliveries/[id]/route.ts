import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Delivery from '@/models/Delivery'
import User from '@/models/User'
import Client from '@/models/Client'
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

async function findOneLean(model: any, query: any) {
  const q = model.findOne(query)
  if (q && typeof q.lean === 'function') return await q.lean()
  return await q
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  // Prefer explicit header when present (test/dev helpers)
  const phoneHeader = request.headers.get('x-user-phone') || undefined
  if (phoneHeader) {
    try {
      await connectDb()
      const user = await (User as any).findOne({ phone: phoneHeader }).select('_id')
      return user?._id?.toString() || null
    } catch {
      // Fall through to JWT if DB lookup fails
    }
  }
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    try { await (request as any).blob?.() } catch {}
    const { id } = await (params as any)
    await connectDb()
    const headersList = await headers()
    const role = String(headersList.get('x-user-role') || '')
    const isPrivileged = role === 'admin' || role === 'manager' || role === 'recon'
    const query: any = { _id: id }
    if (!isPrivileged) query.salesperson = userId
    const item = await findOneLean(Delivery as any, query)
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
    try { await (request as any).clone?.().blob?.() } catch {}
    const { id } = await (params as any)
    const headersList = await headers()
    const userPhone = headersList.get('x-user-phone')
    let userName = headersList.get('x-user-name')
    const role = String(headersList.get('x-user-role') || '')
    const isPrivileged = role === 'admin' || role === 'manager' || role === 'recon'
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

    await connectDb()
    const update: any = {}
    // Load existing to compute audit details and allow partial merges
    const baseQuery: any = { _id: id }
    if (!isPrivileged) baseQuery.salesperson = userId
    const existing: any = await findOneLean(Delivery as any, baseQuery)
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    const setReconOnly = (tasks: any[]) => {
      update.reconTasks = tasks
      // Auto mark reconReady when all tasks done
      const total = tasks.length
      const done = tasks.filter((t: any) => !!t.done).length
      const allDone = total > 0 && done === total
      update.reconReady = allDone
    }

    // Restrict recon role to reconTasks only
    if (role === 'recon') {
      if (Array.isArray(reconTasks)) {
        // Ensure each task has an assignee; default to first recon user if missing
        let defaultReconId: string | null = null
        try {
          const firstRecon = await (User as any).findOne({ role: 'recon' }).select('_id').sort({ createdAt: 1 })
          defaultReconId = firstRecon?._id ? String(firstRecon._id) : null
        } catch {}
        const tasks = reconTasks.map((t: any) => ({
          text: String(t.text || '').trim(),
          done: !!t.done,
          note: t.note || undefined,
          assignee: t.assignee || defaultReconId || undefined,
          dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
          blocked: !!t.blocked,
          blockedReason: t.blocked ? (t.blockedReason || '') : undefined,
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
          updatedAt: new Date(),
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        }))
        setReconOnly(tasks)

        // Build recon-specific audit entry
        const total = tasks.length
        const doneCount = tasks.filter((t: any) => !!t.done).length
        const blockedList = tasks.filter((t: any) => !!t.blocked)
        let details = `Recon updated: ${doneCount}/${total} tasks done`
        if (blockedList.length > 0) {
          const firstBlocked = blockedList[0]
          const reason = firstBlocked.blockedReason ? ` - ${firstBlocked.blockedReason}` : ''
          details = `Recon blocked: ${firstBlocked.text}${reason}`
        } else if (total > 0 && doneCount === total) {
          details = 'Recon completed: all tasks done'
        }
        const auditEntry = {
          action: 'Recon Update',
          user: userName || userPhone || 'unknown',
          timestamp: new Date(),
          details,
        }
        update.$push = { ...(update.$push || {}), auditLog: auditEntry }
      }
    } else {
      // Admin/manager/user flows: accept other fields per original behavior
      if (deliveryDate !== undefined) update.deliveryDate = deliveryDate
      if (financeBank !== undefined) update.financeBank = financeBank
      if (reconNotes !== undefined) update.reconNotes = reconNotes
      if (reconTasks !== undefined) {
        const tasks = (Array.isArray(reconTasks) ? reconTasks : []).map((t: any) => ({
          text: String(t.text || '').trim(),
          done: !!t.done,
          note: t.note || undefined,
          assignee: t.assignee || undefined,
          dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
          blocked: !!t.blocked,
          blockedReason: t.blocked ? (t.blockedReason || '') : undefined,
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
          updatedAt: new Date(),
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        }))
        setReconOnly(tasks)
      }
      if (licensing !== undefined) update.licensing = licensing
      if (customerType !== undefined) update.customerType = customerType
      if (status !== undefined) update.status = status
      if (body.client !== undefined) update.client = body.client || null
      if (additionalDocs !== undefined) update.additionalDocs = additionalDocs
    }
    if (docs !== undefined && Array.isArray(docs) && docs.length > 0 && role !== 'recon') {
      // ensure append, not replace
      update.$push = { ...(update.$push || {}), docs: { $each: docs } }
    }

    // Build human-readable audit entry like Car audit log
    const changes: string[] = []
    const titleize = (k: string) => k.replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase())
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
      const oldArr: any[] = Array.isArray(existing.reconTasks) ? existing.reconTasks : []
      const newArr: any[] = Array.isArray(reconTasks) ? reconTasks : []
      const preview = (s: string) => {
        if (!s) return 'Untitled task'
        const words = String(s).trim().split(/\s+/).slice(0, 3)
        return words.join(' ')
      }
      const idOf = (t: any) => (t && (t._id || t.id)) ? String(t._id || t.id) : ''

      const oldById = new Map<string, any>()
      const newById = new Map<string, any>()
      const oldNoId: any[] = []
      const newNoId: any[] = []
      for (const t of oldArr) {
        const id = idOf(t)
        if (id) oldById.set(id, t); else oldNoId.push(t)
      }
      for (const t of newArr) {
        const id = idOf(t)
        if (id) newById.set(id, t); else newNoId.push(t)
      }

      // Toggled/updated tasks by ID
      for (const [id, oldT] of oldById) {
        const nt = newById.get(id)
        if (!nt) continue // removal handled below
        if (Boolean(oldT.done) !== Boolean(nt.done)) {
          changes.push(`reconTask '${preview(nt.text ?? oldT.text)}' ${nt.done ? 'marked' : 'unmarked'}`)
        }
        // Detect text change (optional)
        if ((oldT.text || '') !== (nt.text || '')) {
          // Keep concise by previewing
          changes.push(`reconTask text updated: '${preview(oldT.text)}' -> '${preview(nt.text)}'`)
        }
      }

      // Added tasks: prefer those without IDs or new IDs not present before
      for (const t of newArr) {
        const id = idOf(t)
        if (id ? !oldById.has(id) : !oldNoId.some(o => (o.text || '') === (t.text || ''))) {
          changes.push(`reconTask added: '${preview(t.text)}'${t.done ? ' (marked)' : ''}`)
        }
      }

      // Removed tasks
      for (const t of oldArr) {
        const id = idOf(t)
        if (id ? !newById.has(id) : !newNoId.some(n => (n.text || '') === (t.text || ''))) {
          changes.push(`reconTask removed: '${preview(t.text)}'`)
        }
      }
    }
    if (typeof licensing !== 'undefined') {
      const same = (() => { try { return JSON.stringify(existing.licensing) === JSON.stringify(licensing) } catch { return false } })()
      if (!same) changes.push('licensing was updated')
    }
    if (typeof customerType !== 'undefined') addFieldChange('customerType', existing.customerType, customerType)
    if (typeof status !== 'undefined') addFieldChange('status', existing.status, status)
    if (typeof additionalDocs !== 'undefined') {
      const prev = existing.additionalDocs || {}
      const curr = additionalDocs || {}
      const keys: Array<'trade_in_natis' | 'source_of_funds' | 'ubo_form'> = ['trade_in_natis','source_of_funds','ubo_form']
      const local: string[] = []
      for (const k of keys) {
        const a = !!(prev as any)[k]
        const b = !!(curr as any)[k]
        if (a !== b) local.push(`'${titleize(k)}' from '${a ? 'Yes' : 'No'}' to '${b ? 'Yes' : 'No'}'`)
      }
      if (local.length) changes.push(`additionalDocs: ${local.join(', ')}`)
    }
    if (Array.isArray(docs) && docs.length) {
      changes.push(`docs were added: ${docs.map((d: any) => titleize(String(d.kind))).join(', ')}`)
    }
    // Resolve client names/phones if client changed
    if (typeof body.client !== 'undefined') {
      try {
        const prevId = existing.client ? String(existing.client) : ''
        const nextId = body.client ? String(body.client) : ''
        const [prevClient, nextClient] = await Promise.all([
          prevId ? (Client as any).findById(prevId).select('firstName lastName phone') : null,
          nextId ? (Client as any).findById(nextId).select('firstName lastName phone') : null,
        ])
        const fmt = (c: any) => !c ? 'N/A' : `${(c.firstName||'').toString()} ${(c.lastName||'').toString()}`.trim() + (c.phone ? ` (${c.phone})` : '')
        if ((prevId || nextId) && (prevId !== nextId)) {
          changes.push(`'client' from '${fmt(prevClient)}' to '${fmt(nextClient)}'`)
        }
      } catch {
        // Fallback to generic if resolution fails
        const oldVal = existing.client ? String(existing.client) : 'N/A'
        const newVal = body.client ? String(body.client) : 'N/A'
        if (oldVal !== newVal) changes.push(`'client' from '${oldVal}' to '${newVal}'`)
      }
    }
    if (changes.length > 0 && role !== 'recon') {
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
      const existingItem = await findOneLean(Delivery as any, baseQuery)
      if (!existingItem) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      return NextResponse.json({ success: true, data: existingItem })
    }

    const item = await Delivery.findOneAndUpdate(
      baseQuery,
      update,
      { new: true }
    )
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
