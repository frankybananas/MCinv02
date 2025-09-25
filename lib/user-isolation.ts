import { ForbiddenError, NotFoundError } from './errors'
import type { SessionData } from './auth-session'
import { isPrivileged } from './auth-session'

type OwnedEntity = {
  createdByPhone?: unknown
}

function normalize(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toString?: () => unknown }
    if (typeof candidate.toString === 'function') {
      const result = candidate.toString()
      return typeof result === 'string' ? result : null
    }
  }
  return null
}

export function ensureClientAccess<T extends OwnedEntity>(client: T | null | undefined, session: SessionData, message = 'Client not found'): T {
  if (!client) {
    throw new NotFoundError(message)
  }
  if (!isPrivileged(session)) {
    const owner = normalize(client.createdByPhone)
    if (!owner || owner !== session.phone) {
      throw new ForbiddenError()
    }
  }
  return client
}

export function ensureMatchAccess<T extends OwnedEntity>(match: T | null | undefined, session: SessionData, message = 'Match not found'): T {
  if (!match) {
    throw new NotFoundError(message)
  }
  if (!isPrivileged(session)) {
    const owner = normalize(match.createdByPhone)
    if (!owner || owner !== session.phone) {
      throw new ForbiddenError()
    }
  }
  return match
}
