import { NextResponse } from 'next/server'
import type { HydratedDocument } from 'mongoose'
import { Types } from 'mongoose'
import { connect as connectDb } from '@/lib/mongodb'
import Client from '@/models/Client'
import Match from '@/models/Match'
import User from '@/models/User'
import type { IMatch } from '@/models/Match'
import type { IUser } from '@/models/User'
import { withParams } from '@/lib/with-params'
import { formatHttpError, isHttpError } from '@/lib/errors'
import { ensureClientAccess } from '@/lib/user-isolation'
import { requireSession } from '@/lib/auth-session'
import type { SessionData } from '@/lib/auth-session'

interface MatchParams extends Record<string, string> {
  id: string
}

type HydratedMatch = HydratedDocument<IMatch>

type ClientRecord = {
  _id: Types.ObjectId
  createdByPhone?: string
}

interface MatchSummary {
  id: string
  carId: string
  status: IMatch['status']
  score: IMatch['score']
  explanation?: IMatch['explanation']
  createdAt: IMatch['createdAt']
}

function isPrivileged(session: SessionData): boolean {
  return session.role === 'admin' || session.role === 'manager'
}

async function fetchClient(clientId: string, session: SessionData): Promise<ClientRecord> {
  const client = await Client.findById(clientId)
  const ensured = ensureClientAccess(client, session, 'Client not found') as { _id: Types.ObjectId | string; createdByPhone?: string }
  const normalizedId = ensured._id instanceof Types.ObjectId ? ensured._id : new Types.ObjectId(String(ensured._id))
  return {
    _id: normalizedId,
    createdByPhone: ensured.createdByPhone,
  }
}

function buildMatchSummary(match: HydratedMatch): MatchSummary {
  const carId = match.car instanceof Types.ObjectId ? match.car.toHexString() : String(match.car)
  const id = match._id instanceof Types.ObjectId ? match._id.toHexString() : String(match._id)
  return {
    id,
    carId,
    status: match.status,
    score: match.score,
    explanation: match.explanation,
    createdAt: match.createdAt,
  }
}

function shouldReturnEmptyForUser(session: SessionData, user: HydratedDocument<IUser> | null): boolean {
  if (isPrivileged(session)) return false
  return Boolean(user && user.matchingEnabled === false)
}

export const GET = withParams<MatchParams>(async (request, { params }) => {
  try {
    const session = await requireSession(request)
    await connectDb()

    const client = await fetchClient(params.id, session)
    const clientId = client._id

    if (!isPrivileged(session)) {
      const currentUser = await User.findOne({ phone: session.phone })
      if (shouldReturnEmptyForUser(session, currentUser)) {
        return NextResponse.json({ success: true, data: [] })
      }
    }

    const query: Record<string, unknown> = { client: clientId }
    if (!isPrivileged(session)) {
      query.createdByPhone = session.phone
    }

    const matches = await Match.find(query)
      .select('car client score explanation status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(50)

    const data = matches.map(buildMatchSummary)
    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
