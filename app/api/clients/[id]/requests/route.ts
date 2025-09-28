import { NextResponse } from 'next/server'
import type { HydratedDocument } from 'mongoose'
import { Types } from 'mongoose'
import { connect as connectDb } from '@/lib/mongodb'
import Client from '@/models/Client'
import ClientRequest from '@/models/ClientRequest'
import Car from '@/models/Car'
import Match from '@/models/Match'
import User from '@/models/User'
import type { IClientRequest } from '@/models/ClientRequest'
import type { IMatch } from '@/models/Match'
import { buildRequestText, embedText, explainMatchShort } from '@/lib/embeddings'
import { upsertRequestVector, searchCarsByVector } from '@/lib/vector-store'
import { withParams } from '@/lib/with-params'
import { formatHttpError, isHttpError } from '@/lib/errors'
import { ensureClientAccess } from '@/lib/user-isolation'
import { requireSession } from '@/lib/auth-session'
import type { SessionData } from '@/lib/auth-session'

interface ClientRequestParams extends Record<string, string> {
  id: string
}

type ClientRecord = {
  _id: Types.ObjectId
  createdByPhone?: string
}
type HydratedClientRequest = HydratedDocument<IClientRequest>

type ClientRequestLike = {
  _id: Types.ObjectId | string
  client: Types.ObjectId | string
  createdByPhone: string
  title?: string
  freeText?: string
  status: IClientRequest['status']
  filters?: Filters
  requestText?: string
  embeddingVector?: number[]
  embeddingModel?: string
  lastEmbeddedAt?: Date
  source?: IClientRequest['source']
  priority?: number
  createdAt: Date
  updatedAt: Date
}

interface ClientRequestResponse {
  id: string
  client: string
  createdByPhone: string
  title?: string
  freeText?: string
  status: IClientRequest['status']
  filters: IClientRequest['filters']
  requestText?: string
  embeddingVector?: number[]
  embeddingModel?: string
  lastEmbeddedAt?: Date
  source?: IClientRequest['source']
  priority?: number
  createdAt: Date
  updatedAt: Date
}

interface CreateRequestBody {
  title?: string
  freeText?: string
  filters: Filters
}

type CarSearchResults = Awaited<ReturnType<typeof searchCarsByVector>>

type Filters = IClientRequest['filters']

function isPrivileged(session: SessionData): boolean {
  return session.role === 'admin' || session.role === 'manager'
}

async function fetchClient(clientId: string, session: SessionData): Promise<ClientRecord> {
  const client = await Client.findById(clientId)
  const ensured = ensureClientAccess(client, session, 'Client not found') as { _id: Types.ObjectId | string; createdByPhone?: string }
  const normalizedId = ensured._id instanceof Types.ObjectId ? ensured._id : new Types.ObjectId(String(ensured._id))
  return {
    _id: normalizedId,
    createdByPhone: ensured.createdByPhone,
  }
}

function toStringId(value: Types.ObjectId | string): string {
  return value instanceof Types.ObjectId ? value.toHexString() : String(value)
}

function normalizeObjectId(value: Types.ObjectId | string): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value)
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }
  return undefined
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return cleaned.length ? cleaned : undefined
}

type ArrayFilterKeys = {
  [K in keyof Filters]: Filters[K] extends (infer _U)[] | undefined ? K : never
}[keyof Filters]

type NumberFilterKeys = {
  [K in keyof Filters]: Filters[K] extends number | undefined ? K : never
}[keyof Filters]

function sanitizeFilters(raw: unknown): Filters {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const filters: Filters = {}

  const setArray = (key: keyof Filters, value: unknown) => {
    const arr = toStringArray(value)
    if (arr) {
      (filters as Record<string, unknown>)[key as string] = arr
    }
  }

  const setNumber = (key: keyof Filters, value: unknown) => {
    const num = toNumber(value)
    if (typeof num === 'number') {
      (filters as Record<string, unknown>)[key as string] = num
    }
  }

  setArray('makes', source.makes)
  setArray('models', source.models)
  setNumber('minYear', source.minYear)
  setNumber('maxYear', source.maxYear)
  setNumber('maxMileageKm', source.maxMileageKm)
  setNumber('minBudgetZar', source.minBudgetZar)
  setNumber('maxBudgetZar', source.maxBudgetZar)
  setNumber('seats', source.seats)
  setArray('fuelTypes', source.fuelTypes)
  setArray('transmissions', source.transmissions)
  setArray('bodyTypes', source.bodyTypes)
  setArray('colors', source.colors)
  setArray('mustHave', source.mustHave)
  setArray('niceToHave', source.niceToHave)
  setArray('excludeTerms', source.excludeTerms)

  return filters
}

function parseCreateRequestBody(value: unknown): CreateRequestBody {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const title = toOptionalString(source.title)
  const freeText = toOptionalString(source.freeText)
  const filters = sanitizeFilters(source.filters)
  return { title, freeText, filters }
}

function buildClientRequestResponse(doc: HydratedClientRequest | ClientRequestLike): ClientRequestResponse {
  const raw = doc as ClientRequestLike
  const docId = toStringId(raw._id)
  const clientId = toStringId(raw.client)
  return {
    id: docId,
    client: clientId,
    createdByPhone: raw.createdByPhone,
    title: raw.title ?? undefined,
    freeText: raw.freeText ?? undefined,
    status: raw.status,
    filters: raw.filters ?? {},
    requestText: raw.requestText ?? undefined,
    embeddingVector: raw.embeddingVector ?? undefined,
    embeddingModel: raw.embeddingModel ?? undefined,
    lastEmbeddedAt: raw.lastEmbeddedAt ?? undefined,
    source: raw.source ?? undefined,
    priority: raw.priority ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

async function isMatchingAllowed(session: SessionData): Promise<boolean> {
  if (isPrivileged(session)) return true
  const user = await User.findOne({ phone: session.phone })
  return user?.matchingEnabled !== false
}

async function upsertMatchesForRequest(
  requestDoc: ClientRequestLike,
  vectorResults: CarSearchResults,
  freeText: string | undefined,
  filters: IClientRequest['filters']
) {
  const topResults = vectorResults.slice(0, 10)
  const requestObjectId = normalizeObjectId(requestDoc._id)
  const requestId = requestObjectId.toHexString()
  for (const result of topResults) {
    const carId = result.payload?.carId ?? (typeof result.id === 'string' ? result.id : undefined)
    if (!carId) continue

    try {
      const car = await Car.findById(carId).populate('images').exec()
      if (!car) continue

      const explanation = await explainMatchShort(car, { freeText, filters })

      await Match.updateOne(
        { request: requestObjectId, car: car._id },
        {
          $setOnInsert: {
            request: requestDoc._id,
            car: car._id,
            client: requestDoc.client,
            createdByPhone: requestDoc.createdByPhone,
            status: 'new' as IMatch['status'],
            createdAt: new Date(),
          },
          $set: {
            score: result.score,
            explanation,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      ).exec()
    } catch (error) {
      if (error instanceof Error) {
        console.error('Match upsert failed', {
          requestId,
          carId,
          error: error.message,
        })
      }
    }
  }
}

export const GET = withParams<ClientRequestParams>(async (request, { params }) => {
  try {
    const session = await requireSession(request)
    await connectDb()

    const client = await fetchClient(params.id, session)

    const requests = await ClientRequest.find({ client: client._id })
      .sort({ updatedAt: -1 })
      .lean<ClientRequestLike[]>({})

    const data = (requests ?? []).map((request: ClientRequestLike) => buildClientRequestResponse(request))
    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withParams<ClientRequestParams>(async (request, { params }) => {
  try {
    const session = await requireSession(request)
    await connectDb()

    const client = await fetchClient(params.id, session)
    const { title, freeText, filters } = parseCreateRequestBody(await request.json().catch(() => null))

    const matchingAllowed = await isMatchingAllowed(session)
    const requestText = buildRequestText({ freeText, filters })

    let vector: number[] | undefined
    if (matchingAllowed) {
      try {
        vector = await embedText(requestText)
      } catch (error) {
        if (error instanceof Error) {
          console.error('Embedding failed for client request', {
            clientId: client._id.toString(),
            error: error.message,
          })
        }
      }
    }

    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

    const requestDoc = await ClientRequest.create({
      client: client._id,
      createdByPhone: client.createdByPhone || session.phone,
      title,
      freeText,
      status: 'active',
      filters,
      requestText,
      ...(vector ? {
        embeddingVector: vector,
        embeddingModel,
        lastEmbeddedAt: new Date(),
      } : {}),
      source: 'manual',
    })

    const toleranceBudget = filters.maxBudgetZar ? filters.maxBudgetZar * 1.2 : undefined
    const toleranceMileage = filters.maxMileageKm ? filters.maxMileageKm * 1.2 : undefined

    const requestObjectId = normalizeObjectId(requestDoc._id as Types.ObjectId | string)
    const requestClientObjectId = normalizeObjectId(requestDoc.client as Types.ObjectId | string)
    const requestId = requestObjectId.toHexString()
    const requestClientId = requestClientObjectId.toHexString()

    if (vector) {
      try {
        await upsertRequestVector(requestId, vector, {
          requestId,
          clientId: requestClientId,
          createdByPhone: requestDoc.createdByPhone,
          status: requestDoc.status,
          maxBudgetZar: toleranceBudget,
          maxMileageKm: toleranceMileage,
          seats: filters.seats,
          makes: filters.makes,
          models: filters.models,
        })
      } catch (error) {
        if (error instanceof Error) {
          console.error('Vector upsert failed', {
            requestId,
            error: error.message,
          })
        }
      }

      const requestDocLean: ClientRequestLike = {
        ...requestDoc.toObject(),
        _id: requestObjectId,
        client: requestClientObjectId,
      }

      try {
        const vectorResults = await searchCarsByVector(vector, {
          topK: 60,
          threshold: 0.78,
          excludeSold: true,
          maxBudgetZar: toleranceBudget,
          maxMileageKm: toleranceMileage,
          seats: filters.seats,
        })

        await upsertMatchesForRequest(requestDocLean, vectorResults, freeText, filters)
      } catch (error) {
        if (error instanceof Error) {
          console.error('Vector search failed', {
            requestId,
            error: error.message,
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: buildClientRequestResponse(requestDoc) })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
