import { QdrantClient } from '@qdrant/js-client-rest'

const VECTOR_BACKEND = process.env.VECTOR_BACKEND || 'qdrant'
const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const OPENAI_EMBEDDING_DIM = Number(process.env.OPENAI_EMBEDDING_DIM || 1536)

export const COLLECTION_CARS = 'cars'
export const COLLECTION_REQUESTS = 'client_requests'

type MatchAny = {
  match: { any: string[] }
}

type RangeFilter = {
  range: {
    gte?: number
    lte?: number
  }
}

type FilterCondition = {
  key: string
} & (MatchAny | RangeFilter)

type FilterObject = {
  must: FilterCondition[]
}

interface SearchResult<TPayload extends Record<string, unknown>> {
  id: string | number
  score: number
  payload?: TPayload
}

function getQdrant(): QdrantClient {
  if (!QDRANT_URL) throw new Error('QDRANT_URL not set')
  return new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY })
}

async function ensureCollection(client: QdrantClient, name: string) {
  try {
    const info = await client.getCollection(name)
    if (info?.status === 'green') return
  } catch {}
  await client.createCollection(name, {
    vectors: { size: OPENAI_EMBEDDING_DIM, distance: 'Cosine' },
  })
}

export async function ensureCollections() {
  if (VECTOR_BACKEND !== 'qdrant') return
  const client = getQdrant()
  await ensureCollection(client, COLLECTION_CARS)
  await ensureCollection(client, COLLECTION_REQUESTS)
}

export type CarPayload = {
  carId: string
  status?: string
  priceZar?: number
  mileageKm?: number
  seats?: number
  make?: string
  model?: string
  year?: number
  imageUrl?: string
}

export type RequestPayload = {
  requestId: string
  clientId: string
  createdByPhone: string
  status?: string
  maxBudgetZar?: number
  maxMileageKm?: number
  seats?: number
  makes?: string[]
  models?: string[]
}

export async function upsertCarVector(carId: string, vector: number[], payload: CarPayload) {
  if (VECTOR_BACKEND !== 'qdrant') return
  const client = getQdrant()
  await ensureCollection(client, COLLECTION_CARS)
  await client.upsert(COLLECTION_CARS, {
    points: [{ id: carId, vector, payload: { ...payload, carId } }],
    wait: true,
  })
}

export async function upsertRequestVector(requestId: string, vector: number[], payload: RequestPayload) {
  if (VECTOR_BACKEND !== 'qdrant') return
  const client = getQdrant()
  await ensureCollection(client, COLLECTION_REQUESTS)
  await client.upsert(COLLECTION_REQUESTS, {
    points: [{ id: requestId, vector, payload: { ...payload, requestId } }],
    wait: true,
  })
}

function buildCarFilter(opts: {
  excludeSold?: boolean
  maxBudgetZar?: number
  maxMileageKm?: number
  seats?: number
}): FilterObject | undefined {
  const must: FilterCondition[] = []

  if (opts.excludeSold !== false) {
    must.push({ key: 'status', match: { any: ['in-stock', 'coming', 'reserved'] } })
  }
  if (typeof opts.maxBudgetZar === 'number' && Number.isFinite(opts.maxBudgetZar)) {
    must.push({ key: 'priceZar', range: { lte: opts.maxBudgetZar } })
  }
  if (typeof opts.maxMileageKm === 'number' && Number.isFinite(opts.maxMileageKm)) {
    must.push({ key: 'mileageKm', range: { lte: opts.maxMileageKm } })
  }
  if (typeof opts.seats === 'number' && Number.isFinite(opts.seats)) {
    must.push({ key: 'seats', range: { gte: opts.seats } })
  }

  return must.length ? { must } : undefined
}

function buildRequestFilter(opts: {
  requireMaxBudgetGte?: number
  requireMaxMileageGte?: number
  requireSeatsLte?: number
}): FilterObject {
  const must: FilterCondition[] = [{ key: 'status', match: { any: ['active'] } }]

  if (typeof opts.requireMaxBudgetGte === 'number' && Number.isFinite(opts.requireMaxBudgetGte)) {
    must.push({ key: 'maxBudgetZar', range: { gte: opts.requireMaxBudgetGte } })
  }
  if (typeof opts.requireMaxMileageGte === 'number' && Number.isFinite(opts.requireMaxMileageGte)) {
    must.push({ key: 'maxMileageKm', range: { gte: opts.requireMaxMileageGte } })
  }
  if (typeof opts.requireSeatsLte === 'number' && Number.isFinite(opts.requireSeatsLte)) {
    must.push({ key: 'seats', range: { lte: opts.requireSeatsLte } })
  }

  return { must }
}

function filterResults<T extends Record<string, unknown>>(
  results: unknown,
  threshold: number
): SearchResult<T>[] {
  if (!Array.isArray(results)) return []
  return results
    .filter((candidate): candidate is { id: unknown; score?: unknown; payload?: unknown } => candidate != null)
    .filter((candidate): candidate is { id: string | number; score: number; payload?: T } => {
      if (typeof candidate.score !== 'number') return false
      if (typeof candidate.id !== 'string' && typeof candidate.id !== 'number') return false
      return true
    })
    .filter((item) => item.score >= threshold)
    .map((item) => ({
      id: item.id,
      score: item.score,
      payload: item.payload,
    }))
}

export async function searchCarsByVector(vector: number[], opts: {
  topK?: number
  threshold?: number
  excludeSold?: boolean
  maxBudgetZar?: number
  maxMileageKm?: number
  seats?: number
}): Promise<SearchResult<CarPayload>[]> {
  const topK = Math.max(1, Math.min(100, opts.topK ?? 60))
  const threshold = opts.threshold ?? 0.78
  if (VECTOR_BACKEND !== 'qdrant') return []

  const client = getQdrant()
  await ensureCollection(client, COLLECTION_CARS)
  const filter = buildCarFilter(opts)
  const response = await client.search(COLLECTION_CARS, {
    vector,
    limit: topK,
    filter,
    with_payload: true,
  })
  return filterResults<CarPayload>(response, threshold)
}

export async function searchRequestsByVector(
  vector: number[],
  opts: {
    topK?: number
    threshold?: number
    requireMaxBudgetGte?: number
    requireMaxMileageGte?: number
    requireSeatsLte?: number
  }
): Promise<SearchResult<RequestPayload>[]> {
  const topK = Math.max(1, Math.min(100, opts.topK ?? 60))
  const threshold = opts.threshold ?? 0.78
  if (VECTOR_BACKEND !== 'qdrant') return []

  const client = getQdrant()
  await ensureCollection(client, COLLECTION_REQUESTS)
  const filter = buildRequestFilter(opts)
  const response = await client.search(COLLECTION_REQUESTS, {
    vector,
    limit: topK,
    filter,
    with_payload: true,
  })
  return filterResults<RequestPayload>(response, threshold)
}
