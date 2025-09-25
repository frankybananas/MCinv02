import OpenAI from 'openai'

const DEFAULT_EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

export function asString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface CarTextSource {
  year?: unknown
  make?: unknown
  model?: unknown
  trim?: unknown
  engine?: unknown
  transmission?: unknown
  seats?: unknown
  kilometers?: unknown
  price?: unknown
  bodyType?: unknown
  fuelType?: unknown
  color?: unknown
  features?: unknown
  notes?: unknown
  [key: string]: unknown
}

export interface RequestFiltersSource {
  makes?: unknown
  models?: unknown
  minYear?: unknown
  maxYear?: unknown
  maxMileageKm?: unknown
  maxBudgetZar?: unknown
  seats?: unknown
  fuelTypes?: unknown
  transmissions?: unknown
  bodyTypes?: unknown
  colors?: unknown
  mustHave?: unknown
  niceToHave?: unknown
  excludeTerms?: unknown
  [key: string]: unknown
}

export interface RequestTextSource {
  freeText?: unknown
  filters?: RequestFiltersSource | null
  [key: string]: unknown
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function asPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value)
  }
  return null
}

export function buildCarSearchText(car: CarTextSource): string {
  const parts: string[] = []

  if (typeof car.year === 'number' || typeof car.year === 'string') parts.push(String(car.year))
  if (typeof car.make === 'string' && car.make.trim()) parts.push(car.make.trim())
  if (typeof car.model === 'string' && car.model.trim()) parts.push(car.model.trim())
  if (typeof car.trim === 'string' && car.trim.trim()) parts.push(car.trim.trim())
  if (typeof car.engine === 'string' && car.engine.trim()) parts.push(car.engine.trim())
  if (typeof car.transmission === 'string' && car.transmission.trim()) parts.push(car.transmission.trim())

  const seats = asPositiveInteger(car.seats)
  if (seats !== null) parts.push(`${seats} seats`)

  const kilometers = asNumber(car.kilometers)
  if (kilometers !== null) parts.push(`${kilometers} km`)

  const price = asNumber(car.price)
  if (price !== null) parts.push(`ZAR ${price}`)

  if (typeof car.bodyType === 'string' && car.bodyType.trim()) parts.push(car.bodyType.trim())
  if (typeof car.fuelType === 'string' && car.fuelType.trim()) parts.push(car.fuelType.trim())
  if (typeof car.color === 'string' && car.color.trim()) parts.push(car.color.trim())

  const featureList = asStringArray(car.features)
  if (featureList.length) parts.push(`features: ${featureList.join(', ')}`)

  if (typeof car.notes === 'string' && car.notes.trim()) parts.push(`notes: ${car.notes.trim()}`)

  return parts.join(' | ')
}

export function buildRequestText(req: RequestTextSource): string {
  const filters = req.filters || {}
  const lines: string[] = []

  if (typeof req.freeText === 'string' && req.freeText.trim()) {
    lines.push(req.freeText.trim())
  }

  const makes = asStringArray(filters.makes)
  if (makes.length) lines.push(`makes: ${makes.join(', ')}`)

  const models = asStringArray(filters.models)
  if (models.length) lines.push(`models: ${models.join(', ')}`)

  const minYear = filters.minYear
  const maxYear = filters.maxYear
  if ((typeof minYear === 'number' && Number.isFinite(minYear)) || (typeof maxYear === 'number' && Number.isFinite(maxYear))) {
    lines.push(`year: ${minYear ?? ''}-${maxYear ?? ''}`)
  }

  const maxMileage = asNumber(filters.maxMileageKm)
  if (maxMileage !== null) lines.push(`max mileage: ${maxMileage} km (+20%)`)

  const maxBudget = asNumber(filters.maxBudgetZar)
  if (maxBudget !== null) lines.push(`max budget: ZAR ${maxBudget} (+20%)`)

  const seats = asPositiveInteger(filters.seats)
  if (seats !== null) lines.push(`${seats} seats`)

  const fuelTypes = asStringArray(filters.fuelTypes)
  if (fuelTypes.length) lines.push(`fuel: ${fuelTypes.join(', ')}`)

  const transmissions = asStringArray(filters.transmissions)
  if (transmissions.length) lines.push(`transmission: ${transmissions.join(', ')}`)

  const bodyTypes = asStringArray(filters.bodyTypes)
  if (bodyTypes.length) lines.push(`body: ${bodyTypes.join(', ')}`)

  const colors = asStringArray(filters.colors)
  if (colors.length) lines.push(`colors: ${colors.join(', ')}`)

  const mustHave = asStringArray(filters.mustHave)
  if (mustHave.length) lines.push(`must have: ${mustHave.join(', ')}`)

  const niceToHave = asStringArray(filters.niceToHave)
  if (niceToHave.length) lines.push(`nice to have: ${niceToHave.join(', ')}`)

  const excludeTerms = asStringArray(filters.excludeTerms)
  if (excludeTerms.length) lines.push(`exclude: ${excludeTerms.join(', ')}`)

  return lines.join(' | ')
}

export async function embedText(text: string, model = DEFAULT_EMBED_MODEL): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

  const client = new OpenAI({ apiKey })
  const input = (text || '').replace(/\s+/g, ' ').trim()
  const { data } = await client.embeddings.create({ model, input })
  const vector = data?.[0]?.embedding

  if (!Array.isArray(vector) || !vector.every((value) => typeof value === 'number')) {
    throw new Error('Failed to get embedding vector')
  }

  return vector
}

export async function explainMatchShort(car: CarTextSource, req: RequestTextSource): Promise<string> {
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

    const output = res.choices?.[0]?.message?.content?.trim()
    return output || summarizeFallback(car, req)
  } catch {
    return summarizeFallback(car, req)
  }
}

function summarizeFallback(car: CarTextSource, req: RequestTextSource): string {
  const bits: string[] = []

  if (typeof car.make === 'string' && typeof car.model === 'string') {
    bits.push(`${car.make} ${car.model}`.trim())
  }

  if (typeof car.year === 'number' || typeof car.year === 'string') {
    bits.push(String(car.year))
  }

  const kilometers = asNumber(car.kilometers)
  if (kilometers !== null) bits.push(`${kilometers}km`)

  const price = asNumber(car.price)
  if (price !== null) bits.push(`ZAR ${price}`)

  const seats = asPositiveInteger(req.filters?.seats)
  if (seats !== null) bits.push(`${seats} seats`)

  return bits.length ? `Matches preferences: ${bits.join(', ')}` : 'Matches customer preferences.'
}
