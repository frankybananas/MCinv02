import { NextResponse } from 'next/server'
import type { HydratedDocument, Types } from 'mongoose'
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

type ClientDocument = NonNullable<Awaited<ReturnType<typeof Client.findById>>>
type HydratedClientRequest = HydratedDocument<IClientRequest>

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
  filters: IClientRequest['filters']
}

type CarSearchResults = Awaited<ReturnType<typeof searchCarsByVector>>

function isPrivileged(session: SessionData): boolean {
  return session.role === 'admin' || session.role === 'manager'
}

async function fetchClient(clientId: string, session: SessionData): Promise<ClientDocument> {
  const client = await Client.findById(clientId)
  return ensureClientAccess(client, session, 'Client not found') as ClientDocument
}

function toStringId(value: Types.ObjectId | string): string {
  return value instanceof Types.ObjectId ? value.toHexString() : String(value)
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

function sanitizeFilters(raw: unknown): IClientRequest['filters'] {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const filters: IClientRequest['filters'] = {}

  const assignArray = (key: keyof IClientRequest['filters'], value: unknown) => {
    const arr = toStringArray(value)
    if (arr) filters[key] = arr
  }

  const assignNumber = (key: keyof IClientRequest['filters'], value: unknown) => {
    const num = toNumber(value)
    if (typeof num === 'number') filters[key] = num
  }

  assignArray('makes', source.makes)
  assignArray('models', source.models)
  assignNumber('minYear', source.minYear)
  assignNumber('maxYear', source.maxYear)
  assignNumber('maxMileageKm', source.maxMileageKm)
  assignNumber('minBudgetZar', source.minBudgetZar)
  assignNumber('maxBudgetZar', source.maxBudgetZar)
  assignNumber('seats', source.seats)
  assignArray('fuelTypes', source.fuelTypes)
  assignArray('transmissions', source.transmissions)
  assignArray('bodyTypes', source.bodyTypes)
  assignArray('colors', source.colors)
  assignArray('mustHave', source.mustHave)
  assignArray('niceToHave', source.niceToHave)
  assignArray('excludeTerms', source.excludeTerms)

  return filters
}

function parseCreateRequestBody(value: unknown): CreateRequestBody {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const title = toOptionalString(source.title)
  const freeText = toOptionalString(source.freeText)
  const filters = sanitizeFilters(source.filters)
  return { title, freeText, filters }
}

function buildClientRequestResponse(doc: HydratedClientRequest): ClientRequestResponse {
  return {
    id: toStringId(doc._id),
    client: toStringId(doc.client),
    createdByPhone: doc.createdByPhone,
    title: doc.title ?? undefined,
    freeText: doc.freeText ?? undefined,
    status: doc.status,
    filters: doc.filters ?? {},
    requestText: doc.requestText ?? undefined,
    embeddingVector: doc.embeddingVector ?? undefined,
    embeddingModel: doc.embeddingModel ?? undefined,
    lastEmbeddedAt: doc.lastEmbeddedAt ?? undefined,
    source: doc.source ?? undefined,
    priority: doc.priority ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function isMatchingAllowed(session: SessionData): Promise<boolean> {
  if (isPrivileged(session)) return true
  const user = await User.findOne({ phone: session.phone })
  return user?.matchingEnabled !== false
}

async function upsertMatchesForRequest(
  requestDoc: HydratedClientRequest,
  vectorResults: CarSearchResults,
  freeText: string | undefined,
  filters: IClientRequest['filters']
) {
  const topResults = vectorResults.slice(0, 10)
  for (const result of topResults) {
    const carId = result.payload?.carId ?? (typeof result.id === 'string' ? result.id : undefined)
    if (!carId) continue

    try {
      const car = await Car.findById(carId).populate('images').exec()
      if (!car) continue

      const explanation = await explainMatchShort(car, { freeText, filters })

      await Match.updateOne(
        { request: requestDoc._id, car: car._id },
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
          requestId: requestDoc._id.toString(),
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

    const data = requests.map(buildClientRequestResponse)
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

    if (vector) {
      try {
        await upsertRequestVector(requestDoc._id.toString(), vector, {
          requestId: requestDoc._id.toString(),
          clientId: toStringId(requestDoc.client),
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
            requestId: requestDoc._id.toString(),
            error: error.message,
          })
        }
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

        await upsertMatchesForRequest(requestDoc, vectorResults, freeText, filters)
      } catch (error) {
        if (error instanceof Error) {
          console.error('Vector search failed', {
            requestId: requestDoc._id.toString(),
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
