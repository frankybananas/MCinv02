import { NextResponse } from 'next/server'
import type { HydratedDocument } from 'mongoose'
import { Types } from 'mongoose'
import { connect as connectDb } from '@/lib/mongodb'
import Client from '@/models/Client'
import ClientRequest from '@/models/ClientRequest'
import type { IClientRequest } from '@/models/ClientRequest'
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
    source: raw.source ?? undefined,
    priority: raw.priority ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
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

    const requestDoc = await ClientRequest.create({
      client: client._id,
      createdByPhone: client.createdByPhone || session.phone,
      title,
      freeText,
      status: 'active',
      filters,
      source: 'manual',
    })

    return NextResponse.json({ success: true, data: buildClientRequestResponse(requestDoc) })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
