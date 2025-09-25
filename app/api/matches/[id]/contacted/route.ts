import { NextResponse } from 'next/server'
import { connect as connectDb } from '@/lib/mongodb'
import type { HydratedDocument } from 'mongoose'
import Match from '@/models/Match'
import Client from '@/models/Client'
import Car from '@/models/Car'
import { getRateLimitIdentity, requireSession } from '@/lib/auth-session'
import { formatHttpError, isHttpError } from '@/lib/errors'
import { withParams } from '@/lib/with-params'
import { ensureMatchAccess } from '@/lib/user-isolation'
import { assertRateLimit } from '@/lib/rate-limit'
import type { IMatch, MatchAuditEntry } from '@/models/Match'

interface MatchParams extends Record<string, string> {
  id: string
}

type InteractionEntry = {
  note: string
  timestamp: Date
}

type ClientDoc = {
  interactionHistory?: InteractionEntry[]
  save: () => Promise<unknown>
}

type CarDoc = {
  year?: number
  make?: string
  model?: string
}

export const POST = withParams<MatchParams>(async (request, { params }) => {
  const matchId = params.id
  try {
    const session = await requireSession(request)
    assertRateLimit({
      key: `match:contact:${getRateLimitIdentity(session)}`,
      limit: 30,
      windowMs: 60_000,
    })

    await connectDb()
    const match = ensureMatchAccess(await Match.findById(matchId) as HydratedDocument<IMatch> | null, session)

    // Update match
    const now = new Date()
    match.status = 'viewed'
    match.contactedAt = now
    match.auditLog = Array.isArray(match.auditLog) ? match.auditLog : []
    const auditEntry: MatchAuditEntry = {
      action: 'contacted',
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

    // Post an interaction on the client
    try {
      const client = await Client.findById(match.client) as (ClientDoc | null)
      const car = await Car.findById(match.car) as (CarDoc | null)
      const carTitle = car ? `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.trim() : 'a matched vehicle'
      const note = `Contacted client about ${carTitle}`
      if (client) {
        client.interactionHistory = Array.isArray(client.interactionHistory) ? client.interactionHistory : []
        const entry: InteractionEntry = { note, timestamp: new Date() }
        client.interactionHistory.push(entry)
        await client.save()
      }
    } catch {}

    return NextResponse.json({ success: true, data: { _id: String(match._id), status: match.status, contactedAt: match.contactedAt } })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
