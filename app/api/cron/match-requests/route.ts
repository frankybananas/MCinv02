import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { markCronError, markCronRunning, markCronSuccess } from '@/lib/cron-metadata';
import ClientRequest from '@/models/ClientRequest';
import { parseClientRequest } from '@/lib/ai/gemini-parser';
import { matchClientToInventory } from '@/lib/matching/match-engine';

const MATCH_STALE_MS = 10 * 60 * 1000;

const HAS_ANY_FILTER_QUERY = {
  $or: [
    { 'filters.makes.0': { $exists: true } },
    { 'filters.models.0': { $exists: true } },
    { 'filters.minYear': { $exists: true } },
    { 'filters.maxYear': { $exists: true } },
    { 'filters.maxMileageKm': { $exists: true } },
    { 'filters.minBudgetZar': { $exists: true } },
    { 'filters.maxBudgetZar': { $exists: true } },
    { 'filters.seats': { $exists: true } },
    { 'filters.fuelTypes.0': { $exists: true } },
    { 'filters.transmissions.0': { $exists: true } },
    { 'filters.bodyTypes.0': { $exists: true } },
    { 'filters.colors.0': { $exists: true } },
    { 'filters.mustHave.0': { $exists: true } },
    { 'filters.niceToHave.0': { $exists: true } },
    { 'filters.excludeTerms.0': { $exists: true } },
  ]
};

async function handleCron(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    await connectToDatabase();
    try {
      await markCronRunning('match-requests');
    } catch (error) {
      console.error('Failed to record cron running state', error);
    }

    const results: Array<Record<string, unknown>> = [];
    const processedIds = new Set<string>();

    // Find requests that have freeText but haven't been parsed
    // We limit to 10 to respect rate limits (60 req/min for free tier)
    const requestsToParse = await ClientRequest.find({
      status: 'active',
      freeText: { $exists: true, $ne: '' },
      $or: [
        { 'aiParsing.parsedAt': { $exists: false } },
        { 'aiParsing': { $exists: false } }
      ]
    }).limit(10);

    for (const req of requestsToParse) {
      const reqId = (req as any)._id?.toString?.() || String((req as any)._id);
      processedIds.add(reqId);
      try {
        if (!req.freeText) continue;

        const parsed = await parseClientRequest(req.freeText);

        req.aiParsing = {
          parsedAt: new Date(),
          confidence: parsed.confidence,
          needsReview: parsed.confidence < 0.6,
          ambiguities: parsed.ambiguities,
          matchCount: req.aiParsing?.matchCount || 0,
          lastMatchedAt: req.aiParsing?.lastMatchedAt,
        };

        req.filters = {
          ...req.filters,
          ...parsed.filters,
        };

        await req.save();

        const matches = await matchClientToInventory(reqId);

        results.push({
          id: reqId,
          stage: 'parse+match',
          success: true,
          confidence: parsed.confidence,
          matchesFound: matches.length,
        });
      } catch (error) {
        console.error(`Failed to parse/match request ${reqId}:`, error);
        results.push({
          id: reqId,
          stage: 'parse+match',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const staleCutoff = new Date(Date.now() - MATCH_STALE_MS);
    const requestsToMatch = await ClientRequest.find({
      status: 'active',
      $and: [
        HAS_ANY_FILTER_QUERY,
        {
          $or: [
            { 'aiParsing.lastMatchedAt': { $exists: false } },
            { 'aiParsing': { $exists: false } },
            { 'aiParsing.lastMatchedAt': { $lt: staleCutoff } },
          ]
        }
      ]
    }).limit(50);

    for (const req of requestsToMatch) {
      const reqId = (req as any)._id?.toString?.() || String((req as any)._id);
      if (processedIds.has(reqId)) continue;
      processedIds.add(reqId);
      try {
        const matches = await matchClientToInventory(reqId);
        results.push({
          id: reqId,
          stage: 'match-only',
          success: true,
          matchesFound: matches.length,
        });
      } catch (error) {
        console.error(`Failed to match request ${reqId}:`, error);
        results.push({
          id: reqId,
          stage: 'match-only',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await markCronSuccess('match-requests', {
        message: `Processed ${results.length} request tasks`,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error('Failed to record cron success state', error);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Cron Job Error:', error);
    try {
      await markCronError('match-requests', error, { durationMs: Date.now() - startedAt });
    } catch (markError) {
      console.error('Failed to record cron error state', markError);
    }
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}
