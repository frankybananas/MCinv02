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
    response_format: { type: 'json_object' } as any,
  })
  const content = res.choices?.[0]?.message?.content
  if (!content) return null
  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object') return null
    parsed.freeText = notes
    if (!parsed.filters) parsed.filters = {}
    return parsed as ParsedRequestResult
  } catch {
    return null
  }
}
