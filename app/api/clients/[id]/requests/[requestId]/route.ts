import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import type { HydratedDocument } from 'mongoose'
import Client from '@/models/Client'
import ClientRequest, { type IClientRequest } from '@/models/ClientRequest'
import type { IClient } from '@/models/Client'
import { buildRequestText, embedText } from '@/lib/embeddings'
import { upsertRequestVector } from '@/lib/vector-store'
import { getRateLimitIdentity, requireSession } from '@/lib/auth-session'
import { BadRequestError, formatHttpError, isHttpError, NotFoundError } from '@/lib/errors'
import { withParams } from '@/lib/with-params'
import { ensureClientAccess } from '@/lib/user-isolation'
import { assertRateLimit } from '@/lib/rate-limit'
import { clientRequestUpdateSchema, normalizeClientRequestUpdate } from '@/lib/validation/client-request'

interface ClientRequestParams extends Record<string, string> {
  id: string
  requestId: string
}

export const PUT = withParams<ClientRequestParams>(async (request, { params }) => {
  const { id: clientId, requestId } = params
  try {
    const session = await requireSession(request)
    assertRateLimit({
      key: `client-request:update:${getRateLimitIdentity(session)}`,
      limit: 10,
      windowMs: 60_000,
    })

    await connectDb()
    const client = ensureClientAccess(await Client.findById(clientId) as (HydratedDocument<IClient> | null), session)

    const rawBody = await request.json()
    const parsed = clientRequestUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new BadRequestError('Invalid request payload', 'INVALID_PAYLOAD', {
        details: parsed.error.flatten(),
        exposeDetails: true,
      })
    }

    const normalized = normalizeClientRequestUpdate(parsed.data)
    const doc = await ClientRequest.findOne({ _id: requestId, client: clientId }) as (HydratedDocument<IClientRequest> | null)
    if (!doc) throw new NotFoundError('Request not found')

    const now = new Date()
    let needEmbed = false

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'title') && typeof normalized.title !== 'undefined' && normalized.title !== doc.title) {
      doc.title = normalized.title
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'freeText')) {
      const newFreeText = typeof normalized.freeText === 'string' ? normalized.freeText : ''
      if (newFreeText !== (doc.freeText ?? '')) {
        doc.freeText = newFreeText
        needEmbed = true
      }
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'filters')) {
      const newFilters = normalized.filters ?? {}
      const currentFilters = doc.filters ?? {}
      if (JSON.stringify(currentFilters) !== JSON.stringify(newFilters)) {
        doc.filters = newFilters as typeof doc.filters
        needEmbed = true
      }
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'status') && typeof normalized.status === 'string' && normalized.status !== doc.status) {
      doc.status = normalized.status
      if (normalized.status === 'active') {
        needEmbed = true
      }
    }

    doc.updatedAt = now

    const shouldEmbed = needEmbed && doc.status === 'active'

    if (shouldEmbed) {
      const requestText = buildRequestText({ freeText: doc.freeText ?? '', filters: doc.filters ?? {} })
      const vector = await embedText(requestText)
      doc.requestText = requestText
      doc.embeddingVector = vector
      doc.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      doc.lastEmbeddedAt = now
    } else if (needEmbed) {
      doc.requestText = undefined
      doc.embeddingVector = undefined
      doc.embeddingModel = undefined
      doc.lastEmbeddedAt = undefined
    }

    await doc.save()

    if ((shouldEmbed || needEmbed) && Array.isArray(doc.embeddingVector)) {
      const tolBudget = doc.filters?.maxBudgetZar ? Number(doc.filters.maxBudgetZar) * 1.2 : undefined
      const tolMileage = doc.filters?.maxMileageKm ? Number(doc.filters.maxMileageKm) * 1.2 : undefined

      await upsertRequestVector(String(doc._id), doc.embeddingVector, {
        requestId: String(doc._id),
        clientId: String(clientId),
        createdByPhone: client.createdByPhone || session.phone,
        status: doc.status,
        maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
        maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
        seats: typeof doc.filters?.seats === 'number' ? doc.filters.seats : undefined,
        makes: Array.isArray(doc.filters?.makes) ? doc.filters.makes : undefined,
        models: Array.isArray(doc.filters?.models) ? doc.filters.models : undefined,
      })
    }

    return NextResponse.json({ success: true, data: doc.toObject() })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const DELETE = withParams<ClientRequestParams>(async (request, { params }) => {
  const { id: clientId, requestId } = params
  try {
    const session = await requireSession(request)
    assertRateLimit({
      key: `client-request:delete:${getRateLimitIdentity(session)}`,
      limit: 5,
      windowMs: 60_000,
    })

    await connectDb()
    ensureClientAccess(await Client.findById(clientId) as (HydratedDocument<IClient> | null), session)

    await ClientRequest.deleteOne({ _id: requestId, client: clientId })
    return NextResponse.json({ success: true, data: {} })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
