import OpenAI from 'openai'

const DEFAULT_EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

export function asString(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

// Simple canonicalizers
export function buildCarSearchText(car: any): string {
  const parts: string[] = []
  if (car.year) parts.push(String(car.year))
  if (car.make) parts.push(String(car.make))
  if (car.model) parts.push(String(car.model))
  if (car.trim) parts.push(String(car.trim))
  if (car.engine) parts.push(String(car.engine))
  if (car.transmission) parts.push(String(car.transmission))
  if (typeof car.seats === 'number') parts.push(`${car.seats} seats`)
  if (typeof car.kilometers === 'number') parts.push(`${car.kilometers} km`)
  if (typeof car.price === 'number') parts.push(`ZAR ${car.price}`)
  if (car.bodyType) parts.push(String(car.bodyType))
  if (car.fuelType) parts.push(String(car.fuelType))
  if (car.color) parts.push(String(car.color))
  if (Array.isArray(car.features)) parts.push(`features: ${car.features.join(', ')}`)
  if (car.notes) parts.push(`notes: ${car.notes}`)
  return parts.join(' | ')
}

export function buildRequestText(req: { freeText?: string, filters?: any }): string {
  const f = req.filters || {}
  const lines: string[] = []
  if (req.freeText) lines.push(req.freeText)
  if (Array.isArray(f.makes) && f.makes.length) lines.push(`makes: ${f.makes.join(', ')}`)
  if (Array.isArray(f.models) && f.models.length) lines.push(`models: ${f.models.join(', ')}`)
  if (f.minYear || f.maxYear) lines.push(`year: ${f.minYear ?? ''}-${f.maxYear ?? ''}`)
  if (f.maxMileageKm) lines.push(`max mileage: ${f.maxMileageKm} km (+20%)`)
  if (f.maxBudgetZar) lines.push(`max budget: ZAR ${f.maxBudgetZar} (+20%)`)
  if (f.seats) lines.push(`${f.seats} seats`)
  if (Array.isArray(f.fuelTypes) && f.fuelTypes.length) lines.push(`fuel: ${f.fuelTypes.join(', ')}`)
  if (Array.isArray(f.transmissions) && f.transmissions.length) lines.push(`transmission: ${f.transmissions.join(', ')}`)
  if (Array.isArray(f.bodyTypes) && f.bodyTypes.length) lines.push(`body: ${f.bodyTypes.join(', ')}`)
  if (Array.isArray(f.colors) && f.colors.length) lines.push(`colors: ${f.colors.join(', ')}`)
  if (Array.isArray(f.mustHave) && f.mustHave.length) lines.push(`must have: ${f.mustHave.join(', ')}`)
  if (Array.isArray(f.niceToHave) && f.niceToHave.length) lines.push(`nice to have: ${f.niceToHave.join(', ')}`)
  if (Array.isArray(f.excludeTerms) && f.excludeTerms.length) lines.push(`exclude: ${f.excludeTerms.join(', ')}`)
  return lines.join(' | ')
}

export async function embedText(text: string, model = DEFAULT_EMBED_MODEL): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const client = new OpenAI({ apiKey })
  const input = (text || '').replace(/\s+/g, ' ').trim()
  const { data } = await client.embeddings.create({ model, input })
  const vec = data?.[0]?.embedding
  if (!Array.isArray(vec)) throw new Error('Failed to get embedding vector')
  return vec as unknown as number[]
}

export async function explainMatchShort(car: any, req: any): Promise<string> {
  // Keep explanations short; fallback to deterministic string if LLM not configured
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return summarizeFallback(car, req)
    const client = new OpenAI({ apiKey })
    const prompt = `In one short sentence, explain why this car matches the customer's request.\n\nRequest: ${buildRequestText(req)}\nCar: ${buildCarSearchText(car)}\nAnswer:`
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_REASONING_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You write very concise, sales-friendly explanations (max ~20 words). No extra punctuation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 60,
    })
    const out = res.choices?.[0]?.message?.content?.trim()
    return out || summarizeFallback(car, req)
  } catch {
    return summarizeFallback(car, req)
  }
}

function summarizeFallback(car: any, req: any): string {
  const bits: string[] = []
  if (car.make && car.model) bits.push(`${car.make} ${car.model}`)
  if (car.year) bits.push(String(car.year))
  if (typeof car.kilometers === 'number') bits.push(`${car.kilometers}km`)
  if (typeof car.price === 'number') bits.push(`ZAR ${car.price}`)
  if (req?.filters?.seats) bits.push(`${req.filters.seats} seats`)
  return `Matches preferences: ${bits.join(', ')}`
}
