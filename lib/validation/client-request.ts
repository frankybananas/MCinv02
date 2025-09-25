import { z } from 'zod'

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

const MAX_FREE_TEXT_LENGTH = 2000
const MAX_TITLE_LENGTH = 120

const stringArraySchema = z.preprocess((value) => {
  if (!Array.isArray(value)) return value
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}, z.array(z.string().min(1).max(64)).max(20))

const sanitizeNumber = (value: unknown): number | undefined => {
  if (value === null || typeof value === 'undefined') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const trimmed = value.replace(/[,\s]/g, '')
    if (trimmed === '') return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const boundedNumber = (min: number, max: number, options?: { round?: boolean }) =>
  z
    .preprocess((value) => {
      const numeric = sanitizeNumber(value)
      if (typeof numeric === 'undefined') return undefined
      const normalized = options?.round ? Math.round(numeric) : numeric
      return normalized
    }, z.number().min(min).max(max))
    .optional()

const filtersSchema = z
  .object({
    makes: stringArraySchema.optional(),
    models: stringArraySchema.optional(),
    minYear: boundedNumber(1950, 2100, { round: true }),
    maxYear: boundedNumber(1950, 2100, { round: true }),
    maxMileageKm: boundedNumber(0, 1_000_000, { round: true }),
    minBudgetZar: boundedNumber(0, 100_000_000, { round: true }),
    maxBudgetZar: boundedNumber(0, 100_000_000, { round: true }),
    seats: boundedNumber(1, 12, { round: true }),
    fuelTypes: stringArraySchema.optional(),
    transmissions: stringArraySchema.optional(),
    bodyTypes: stringArraySchema.optional(),
    colors: stringArraySchema.optional(),
    mustHave: stringArraySchema.optional(),
    niceToHave: stringArraySchema.optional(),
    excludeTerms: stringArraySchema.optional(),
  })
  .strict()
  .refine((data) => {
    if (typeof data.minYear === 'number' && typeof data.maxYear === 'number') {
      return data.minYear <= data.maxYear
    }
    return true
  }, { message: 'minYear cannot be greater than maxYear', path: ['minYear'] })
  .refine((data) => {
    if (typeof data.minBudgetZar === 'number' && typeof data.maxBudgetZar === 'number') {
      return data.minBudgetZar <= data.maxBudgetZar
    }
    return true
  }, { message: 'minBudgetZar cannot be greater than maxBudgetZar', path: ['minBudgetZar'] })

export const clientRequestUpdateSchema = z
  .object({
    title: z.string().max(MAX_TITLE_LENGTH).optional(),
    freeText: z.string().max(MAX_FREE_TEXT_LENGTH).optional(),
    filters: filtersSchema.optional(),
    status: z.enum(['active', 'paused', 'completed']).optional(),
  })
  .strict()

export type ClientRequestFilters = z.infer<typeof filtersSchema>

export interface ClientRequestUpdatePayload {
  title?: string
  freeText?: string
  filters?: ClientRequestFilters
  status?: 'active' | 'paused' | 'completed'
}

const sanitizeTitle = (value: string): string => {
  const normalized = value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
  return normalized.slice(0, MAX_TITLE_LENGTH)
}

const sanitizeFreeText = (value: string): string => {
  const normalized = value
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .trim()
  return normalized.slice(0, MAX_FREE_TEXT_LENGTH)
}

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(value)
    }
  }
  return result
}

const normalizeStringArray = (values?: string[]): string[] | undefined => {
  if (!values) return undefined
  if (values.length === 0) return []
  return dedupeStrings(values.map((value) => value.trim()).filter((value) => value.length > 0))
}

function normalizeFilters(filters?: ClientRequestFilters): ClientRequestFilters | undefined {
  if (!filters) return undefined
  const normalized: ClientRequestFilters = {}

  const makes = normalizeStringArray(filters.makes)
  if (typeof makes !== 'undefined') normalized.makes = makes

  const models = normalizeStringArray(filters.models)
  if (typeof models !== 'undefined') normalized.models = models

  if (typeof filters.minYear === 'number') normalized.minYear = Math.round(filters.minYear)
  if (typeof filters.maxYear === 'number') normalized.maxYear = Math.round(filters.maxYear)
  if (typeof filters.maxMileageKm === 'number') normalized.maxMileageKm = Math.round(filters.maxMileageKm)
  if (typeof filters.minBudgetZar === 'number') normalized.minBudgetZar = Math.round(filters.minBudgetZar)
  if (typeof filters.maxBudgetZar === 'number') normalized.maxBudgetZar = Math.round(filters.maxBudgetZar)
  if (typeof filters.seats === 'number') normalized.seats = Math.round(filters.seats)

  const fuelTypes = normalizeStringArray(filters.fuelTypes)
  if (typeof fuelTypes !== 'undefined') normalized.fuelTypes = fuelTypes

  const transmissions = normalizeStringArray(filters.transmissions)
  if (typeof transmissions !== 'undefined') normalized.transmissions = transmissions

  const bodyTypes = normalizeStringArray(filters.bodyTypes)
  if (typeof bodyTypes !== 'undefined') normalized.bodyTypes = bodyTypes

  const colors = normalizeStringArray(filters.colors)
  if (typeof colors !== 'undefined') normalized.colors = colors

  const mustHave = normalizeStringArray(filters.mustHave)
  if (typeof mustHave !== 'undefined') normalized.mustHave = mustHave

  const niceToHave = normalizeStringArray(filters.niceToHave)
  if (typeof niceToHave !== 'undefined') normalized.niceToHave = niceToHave

  const excludeTerms = normalizeStringArray(filters.excludeTerms)
  if (typeof excludeTerms !== 'undefined') normalized.excludeTerms = excludeTerms

  return normalized
}

export function normalizeClientRequestUpdate(data: ClientRequestUpdatePayload): ClientRequestUpdatePayload {
  const normalized: ClientRequestUpdatePayload = {}

  if (typeof data.title === 'string') {
    normalized.title = sanitizeTitle(data.title)
  }

  if (typeof data.freeText === 'string') {
    normalized.freeText = sanitizeFreeText(data.freeText)
  }

  if (typeof data.status === 'string') {
    normalized.status = data.status
  }

  const filters = normalizeFilters(data.filters)
  if (typeof filters !== 'undefined') {
    normalized.filters = filters
  }

  return normalized
}
