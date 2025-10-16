import { jwtVerify, type JWTPayload } from 'jose'
import { UnauthorizedError } from './errors'

export interface SessionData {
  token: string
  phone: string
  role: string | null
  userId: string | null
  lastOtpAt?: number | null
  payload: JWTPayload
}

interface CookieMap {
  [key: string]: string
}

function parseCookies(header: string | null): CookieMap {
  if (!header) return {}
  return header.split(';').reduce<CookieMap>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) return acc
    acc[rawKey] = decodeURIComponent(rawValue.join('='))
    return acc
  }, {})
}

function getJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new UnauthorizedError('Unauthorized')
  }
  return new TextEncoder().encode(jwtSecret)
}

export async function getSession(request: Request): Promise<SessionData | null> {
  try {
    const cookies = parseCookies(request.headers.get('cookie'))
    const token = cookies.session_token
    if (!token) return null

    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)

    const phone = typeof payload.phone === 'string' ? payload.phone : null
    if (!phone) return null

    const role = typeof payload.role === 'string' ? payload.role : null
    const userId = typeof payload.userId === 'string' ? payload.userId : null
    const lastOtpAt = typeof payload.lastOtpAt === 'number' ? payload.lastOtpAt : null

    return {
      token,
      phone,
      role,
      userId,
      lastOtpAt,
      payload,
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    return null
  }
}

export async function requireSession(request: Request): Promise<SessionData> {
  const session = await getSession(request)
  if (!session) {
    throw new UnauthorizedError()
  }
  return session
}

export function isPrivileged(session: SessionData | null | undefined): boolean {
  if (!session) return false
  return session.role === 'admin' || session.role === 'manager'
}

export function getRateLimitIdentity(session: SessionData): string {
  return session.phone
}
