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

    const requests = await ClientRequest.find({ client: clientId }).sort({ updatedAt: -1 })
    return NextResponse.json({ success: true, data: requests })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
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

    const body = await request.json()
    const { title, freeText, filters } = body || {}

    const requestText = buildRequestText({ freeText, filters })
    let vector: number[] | null = null
    try {
      vector = await embedText(requestText)
    } catch (e) {
      console.error('Embedding failed for client request', { clientId, err: (e as any)?.message })
    }

    const doc = await ClientRequest.create({
      client: clientId,
      createdByPhone: client.createdByPhone || phone,
      title: typeof title === 'string' ? title : undefined,
      freeText: typeof freeText === 'string' ? freeText : undefined,
      status: 'active',
      filters: filters || {},
      requestText,
      ...(Array.isArray(vector) ? {
        embeddingVector: vector,
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        lastEmbeddedAt: new Date(),
      } : {}),
      source: 'manual',
    })

    // Upsert into vector store (best-effort)
    const tolBudget = (filters?.maxBudgetZar ? Number(filters.maxBudgetZar) * 1.2 : undefined)
    const tolMileage = (filters?.maxMileageKm ? Number(filters.maxMileageKm) * 1.2 : undefined)

    if (Array.isArray(vector)) {
      try {
        await upsertRequestVector(String(doc._id), vector, {
          requestId: String(doc._id),
          clientId: String(clientId),
          createdByPhone: client.createdByPhone || phone,
          status: 'active',
          maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
          maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
          seats: typeof filters?.seats === 'number' ? filters.seats : undefined,
          makes: Array.isArray(filters?.makes) ? filters.makes : undefined,
          models: Array.isArray(filters?.models) ? filters.models : undefined,
        })
      } catch (e) {
        console.error('Vector upsert failed', { requestId: String(doc._id), err: (e as any)?.message })
      }
    }

    // Search cars for this single request (best-effort)
    let results: any[] = []
    if (Array.isArray(vector)) {
      try {
        results = await searchCarsByVector(vector, {
          topK: 60,
          threshold: 0.78,
          excludeSold: true,
          maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
          maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
          seats: typeof filters?.seats === 'number' ? filters.seats : undefined,
        })
      } catch (e) {
        console.error('Vector search failed', { requestId: String(doc._id), err: (e as any)?.message })
      }
    }

    const top = results.slice(0, 10)
    for (const r of top) {
      const carId = (r as any).id || (r as any)?.payload?.carId
      if (!carId) continue
      try {
        const car = await Car.findById(carId).populate('images')
        if (!car) continue
        const explanation = await explainMatchShort(car, { freeText, filters })
        await Match.updateOne(
          { request: doc._id, car: car._id },
          {
            $setOnInsert: {
              request: doc._id,
              car: car._id,
              client: client._id,
              createdByPhone: client.createdByPhone || phone,
              status: 'new',
              createdAt: new Date(),
            },
            $set: {
              score: typeof r.score === 'number' ? r.score : 0,
              explanation,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        )
      } catch {}
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
