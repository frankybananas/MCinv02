import { QdrantClient } from '@qdrant/js-client-rest'

const VECTOR_BACKEND = process.env.VECTOR_BACKEND || 'qdrant'
const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const OPENAI_EMBEDDING_DIM = Number(process.env.OPENAI_EMBEDDING_DIM || 1536)

export const COLLECTION_CARS = 'cars'
export const COLLECTION_REQUESTS = 'client_requests'

function getQdrant() {
  if (!QDRANT_URL) throw new Error('QDRANT_URL not set')
  const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY })
  return client
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
  const c = getQdrant()
  await ensureCollection(c, COLLECTION_CARS)
  await ensureCollection(c, COLLECTION_REQUESTS)
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
  if (VECTOR_BACKEND === 'qdrant') {
    const c = getQdrant()
    await ensureCollection(c, COLLECTION_CARS)
    await c.upsert(COLLECTION_CARS, {
      points: [{ id: carId, vector, payload: { ...payload, carId } }],
      wait: true,
    })
    return
  }
  // no-op on other backends for now
}

export async function upsertRequestVector(requestId: string, vector: number[], payload: RequestPayload) {
  if (VECTOR_BACKEND === 'qdrant') {
    const c = getQdrant()
    await ensureCollection(c, COLLECTION_REQUESTS)
    await c.upsert(COLLECTION_REQUESTS, {
      points: [{ id: requestId, vector, payload: { ...payload, requestId } }],
      wait: true,
    })
    return
  }
}

export async function searchCarsByVector(vector: number[], opts: {
  topK?: number
  threshold?: number
  excludeSold?: boolean
  maxBudgetZar?: number
  maxMileageKm?: number
  seats?: number
}) {
  const topK = Math.max(1, Math.min(100, opts.topK ?? 60))
  const threshold = opts.threshold ?? 0.78
  if (VECTOR_BACKEND === 'qdrant') {
    const c = getQdrant()
    await ensureCollection(c, COLLECTION_CARS)
    const must: any[] = []
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
    const filter = must.length ? { must } : undefined
    const res = await c.search(COLLECTION_CARS, { vector, limit: topK, filter, with_payload: true })
    return (res || []).filter((r: any) => (typeof r?.score === 'number' ? r.score : 0) >= threshold)
  }
  return []
}

export async function searchRequestsByVector(vector: number[], opts: { topK?: number; threshold?: number; requireMaxBudgetGte?: number; requireMaxMileageGte?: number; requireSeatsLte?: number }) {
  const topK = Math.max(1, Math.min(100, opts.topK ?? 60))
  const threshold = opts.threshold ?? 0.78
  if (VECTOR_BACKEND === 'qdrant') {
    const c = getQdrant()
    await ensureCollection(c, COLLECTION_REQUESTS)
    const must: any[] = [ { key: 'status', match: { any: ['active'] } } ]
    if (typeof opts.requireMaxBudgetGte === 'number' && Number.isFinite(opts.requireMaxBudgetGte)) {
      must.push({ key: 'maxBudgetZar', range: { gte: opts.requireMaxBudgetGte } })
    }
    if (typeof opts.requireMaxMileageGte === 'number' && Number.isFinite(opts.requireMaxMileageGte)) {
      must.push({ key: 'maxMileageKm', range: { gte: opts.requireMaxMileageGte } })
    }
    if (typeof opts.requireSeatsLte === 'number' && Number.isFinite(opts.requireSeatsLte)) {
      must.push({ key: 'seats', range: { lte: opts.requireSeatsLte } })
    }
    const filter = { must }
    const res = await c.search(COLLECTION_REQUESTS, { vector, limit: topK, filter, with_payload: true })
    return (res || []).filter((r: any) => (typeof r?.score === 'number' ? r.score : 0) >= threshold)
  }
  return []
}
