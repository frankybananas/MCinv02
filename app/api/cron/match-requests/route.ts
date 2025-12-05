import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ClientRequest from '@/models/ClientRequest';
import { parseClientRequest } from '@/lib/ai/gemini-parser';
import { matchClientToInventory } from '@/lib/matching/match-engine';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();

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

    const results = [];

    for (const req of requestsToParse) {
      try {
        if (!req.freeText) continue;

        const parsed = await parseClientRequest(req.freeText);
        
        req.aiParsing = {
          parsedAt: new Date(),
          confidence: parsed.confidence,
          needsReview: parsed.confidence < 0.6,
          ambiguities: parsed.ambiguities,
          matchCount: req.aiParsing?.matchCount || 0,
          lastMatchedAt: req.aiParsing?.lastMatchedAt
        };
        
        req.filters = {
            ...req.filters,
            ...parsed.filters
        };
        
        await req.save();

        // Trigger matching
        const matches = await matchClientToInventory((req as any)._id.toString());

        results.push({ 
          id: (req as any)._id, 
          success: true, 
          confidence: parsed.confidence,
          matchesFound: matches.length 
        });
      } catch (error) {
        console.error(`Failed to process request ${(req as any)._id}:`, error);
        results.push({ id: (req as any)._id, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length, 
      results 
    });
  } catch (error) {
    console.error('Cron Job Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
