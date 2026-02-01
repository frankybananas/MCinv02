import { jwtVerify, type JWTPayload } from 'jose'
import { UnauthorizedError } from './errors'

const OTP_REAUTH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isOtpExpired(lastOtpAt?: number | null): boolean {
  if (!lastOtpAt) return true
  return Date.now() - lastOtpAt >= OTP_REAUTH_WINDOW_MS
}

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
    let userId: string | null = null
    if (typeof (payload as any).userId === 'string') {
      userId = (payload as any).userId
    } else if ((payload as any).userId && typeof (payload as any).userId.toString === 'function') {
      try { userId = (payload as any).userId.toString() } catch { userId = null }
    }
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
  if (isOtpExpired(session.lastOtpAt)) {
    throw new UnauthorizedError('OTP expired', 'OTP_EXPIRED')
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

/**
 * Verifies that the session is still active in the database.
 * Should be called on write operations (POST/PUT/DELETE/PATCH).
 * Throws UnauthorizedError if session is invalid or inactive.
 */
export async function verifyActiveSession(session: SessionData): Promise<void> {
  // Skip DB check in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const jti = session.payload.jti as string | undefined
  if (!jti) {
    throw new UnauthorizedError('Invalid session')
  }

  // Lazy import to avoid circular deps
  const { connect } = await import('@/lib/mongodb')
  const Session = (await import('@/models/Session')).default

  await connect()
  const active = await Session.findOne({ jwtId: jti, isActive: true })
  if (!active) {
    throw new UnauthorizedError('Invalid session')
  }
}
