import OpenAI from 'openai'

export interface ParsedRequestFilters {
  makes?: string[]
  models?: string[]
  minYear?: number
  maxYear?: number
  maxMileageKm?: number
  minBudgetZar?: number
  maxBudgetZar?: number
  seats?: number
  fuelTypes?: string[]
  transmissions?: string[]
  bodyTypes?: string[]
  colors?: string[]
  mustHave?: string[]
  niceToHave?: string[]
  excludeTerms?: string[]
}

export interface ParsedRequestResult {
  title?: string
  freeText?: string
  filters: ParsedRequestFilters
}

interface RawParsedRequest {
  title?: unknown
  freeText?: unknown
  filters?: Record<string, unknown>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return value
}

function asPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  if (!Number.isFinite(value)) return undefined
  const rounded = Math.trunc(value)
  return rounded >= 0 ? rounded : undefined
}

function normalizeFilters(raw: Record<string, unknown> | undefined): ParsedRequestFilters {
  const input = raw ?? {}
  return {
    makes: asStringArray(input.makes),
    models: asStringArray(input.models),
    minYear: asNumber(input.minYear),
    maxYear: asNumber(input.maxYear),
    maxMileageKm: asNumber(input.maxMileageKm),
    minBudgetZar: asNumber(input.minBudgetZar),
    maxBudgetZar: asNumber(input.maxBudgetZar),
    seats: asPositiveInteger(input.seats),
    fuelTypes: asStringArray(input.fuelTypes),
    transmissions: asStringArray(input.transmissions),
    bodyTypes: asStringArray(input.bodyTypes),
    colors: asStringArray(input.colors),
    mustHave: asStringArray(input.mustHave),
    niceToHave: asStringArray(input.niceToHave),
    excludeTerms: asStringArray(input.excludeTerms),
  }
}

function normalizeParsedResult(raw: RawParsedRequest, notes: string): ParsedRequestResult {
  const title = typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title.trim() : undefined
  const freeText = typeof raw.freeText === 'string' && raw.freeText.trim().length > 0 ? raw.freeText.trim() : notes
  const filters = normalizeFilters(raw.filters)
  return { title, freeText, filters }
}

export async function parseNotesToRequest(notes: string): Promise<ParsedRequestResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const client = new OpenAI({ apiKey })

  const sys = 'You extract car-buying preferences from short notes. Output STRICT JSON only with keys: title (string), freeText (string), filters (object). Do not include any commentary.'
  const user = `Notes: ${notes}\n\nRules:\n- Currency is ZAR; detect budgets like R900k or 900000 and put into maxBudgetZar as number.\n- Detect mileage like 100k km or 100,000km -> maxMileageKm number.\n- Detect seats count if present.\n- Extract make/model preferences if present.\n- Keep arrays lowercased strings.\n- Infer a short title like '7-seater under 900k'.\nReturn JSON only.`

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_REASONING_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  })
  const content = res.choices?.[0]?.message?.content
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeParsedResult(parsed as RawParsedRequest, notes)
  } catch {
    return null
  }
}
