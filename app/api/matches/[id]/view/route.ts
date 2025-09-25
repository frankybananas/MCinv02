import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import type { HydratedDocument } from 'mongoose'
import Match from '@/models/Match'
import { getRateLimitIdentity, requireSession } from '@/lib/auth-session'
import { formatHttpError, isHttpError } from '@/lib/errors'
import { withParams } from '@/lib/with-params'
import { ensureMatchAccess } from '@/lib/user-isolation'
import { assertRateLimit } from '@/lib/rate-limit'
import type { IMatch, MatchAuditEntry } from '@/models/Match'

interface MatchParams extends Record<string, string> {
  id: string
}

export const POST = withParams<MatchParams>(async (request, { params }) => {
  const matchId = params.id
  try {
    const session = await requireSession(request)
    assertRateLimit({
      key: `match:view:${getRateLimitIdentity(session)}`,
      limit: 60,
      windowMs: 60_000,
    })

    await connectDb()
    const match = ensureMatchAccess(await Match.findById(matchId) as HydratedDocument<IMatch> | null, session)

    const now = new Date()
    match.status = 'viewed'
    match.viewedAt = now
    match.auditLog = Array.isArray(match.auditLog) ? match.auditLog : []
    const auditEntry: MatchAuditEntry = {
      action: 'viewed',
      performedBy: session.phone,
      timestamp: now,
      metadata: {
        matchId: String(match._id),
        clientId: String(match.client),
        carId: String(match.car),
      },
    }
    match.auditLog.push(auditEntry)
    await match.save()

    return NextResponse.json({ success: true, data: { _id: String(match._id), status: match.status, viewedAt: match.viewedAt } })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
