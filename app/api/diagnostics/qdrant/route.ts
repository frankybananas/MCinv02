import { NextResponse } from 'next/server'
import { ensureCollections, upsertRequestVector, searchRequestsByVector } from '@/lib/vector-store'

export async function GET(request: Request) {
  await request.clone().blob()
  const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333'
  const OPENAI_EMBEDDING_DIM = Number(process.env.OPENAI_EMBEDDING_DIM || 1536)

  const result: any = { ok: true, steps: [] as any[] }

  // 1) Ready check via HTTP
  try {
    const r = await fetch(`${QDRANT_URL.replace(/\/$/, '')}/readyz`, { cache: 'no-store' })
    const ready = r.ok
    result.steps.push({ step: 'readyz', ok: ready, status: r.status })
    if (!ready) throw new Error(`Qdrant not ready: HTTP ${r.status}`)
  } catch (err: any) {
    result.ok = false
    result.steps.push({ step: 'readyz', ok: false, error: err?.message || String(err) })
    return NextResponse.json(result, { status: 500 })
  }

  // 2) Ensure collections exist
  try {
    await ensureCollections()
    result.steps.push({ step: 'ensureCollections', ok: true })
  } catch (err: any) {
    result.ok = false
    result.steps.push({ step: 'ensureCollections', ok: false, error: err?.message || String(err) })
    return NextResponse.json(result, { status: 500 })
  }

  // 3) Round-trip in requests collection: upsert + search
  try {
    const id = `diag-${Date.now()}`
    const zeroVec = new Array(OPENAI_EMBEDDING_DIM).fill(0)
    await upsertRequestVector(id, zeroVec, {
      requestId: id,
      clientId: 'diag-client',
      createdByPhone: 'diag',
      status: 'active',
      maxBudgetZar: 123456,
    })
    const hits = await searchRequestsByVector(zeroVec, { topK: 5, threshold: 0.0 })
    const found = Array.isArray(hits) && hits.some((h: any) => String(h.id) === id)
    result.steps.push({ step: 'roundTrip', ok: found, hitCount: hits?.length ?? 0 })
    if (!found) {
      result.ok = false
      return NextResponse.json(result, { status: 500 })
    }
  } catch (err: any) {
    result.ok = false
    result.steps.push({ step: 'roundTrip', ok: false, error: err?.message || String(err) })
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
