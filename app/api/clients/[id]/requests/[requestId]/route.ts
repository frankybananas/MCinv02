import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { connect as connectDb } from '@/lib/mongodb'
import Client from '@/models/Client'
import ClientRequest from '@/models/ClientRequest'
import Car from '@/models/Car'
import Match from '@/models/Match'
import { buildRequestText, embedText, explainMatchShort } from '@/lib/embeddings'
import { upsertRequestVector, searchCarsByVector } from '@/lib/vector-store'

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

export async function PUT(request: Request, ctx: { params: { id: string; requestId: string } }) {
  await request.clone().blob()
  const { id, requestId } = await (ctx as any).params
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

    const body = await request.json()
    const { title, freeText, filters, status } = body || {}

    const update: any = { updatedAt: new Date() }
    if (typeof title === 'string') update.title = title
    if (typeof freeText === 'string') update.freeText = freeText
    if (filters && typeof filters === 'object') update.filters = filters
    if (typeof status === 'string') update.status = status

    // Re-embed if content changed or status toggled to active
    let needEmbed = false
    if (typeof freeText === 'string' || (filters && typeof filters === 'object') || status === 'active') needEmbed = true

    if (needEmbed) {
      const requestText = buildRequestText({ freeText: freeText ?? '', filters: filters ?? {} })
      const vector = await embedText(requestText)
      update.requestText = requestText
      update.embeddingVector = vector
      update.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      update.lastEmbeddedAt = new Date()
    }

    const doc = await ClientRequest.findOneAndUpdate({ _id: requestId, client: clientId }, { $set: update }, { new: true })
    if (!doc) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })

    if (needEmbed && Array.isArray(doc.embeddingVector)) {
      const tolBudget = (doc.filters?.maxBudgetZar ? Number(doc.filters.maxBudgetZar) * 1.2 : undefined)
      const tolMileage = (doc.filters?.maxMileageKm ? Number(doc.filters.maxMileageKm) * 1.2 : undefined)

      await upsertRequestVector(String(doc._id), doc.embeddingVector, {
        requestId: String(doc._id),
        clientId: String(clientId),
        createdByPhone: client.createdByPhone || phone,
        status: doc.status,
        maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
        maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
        seats: typeof doc.filters?.seats === 'number' ? doc.filters.seats : undefined,
        makes: Array.isArray(doc.filters?.makes) ? doc.filters.makes : undefined,
        models: Array.isArray(doc.filters?.models) ? doc.filters.models : undefined,
      })
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, ctx: { params: { id: string; requestId: string } }) {
  await request.clone().blob()
  const { id, requestId } = await (ctx as any).params
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

    await ClientRequest.deleteOne({ _id: requestId, client: clientId })
    return NextResponse.json({ success: true, data: {} })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
