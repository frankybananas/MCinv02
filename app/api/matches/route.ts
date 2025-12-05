import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';
import VehicleMatch from '@/models/VehicleMatch';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const status = searchParams.get('status');
    const minScore = searchParams.get('minScore');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    const query: any = {
      createdByPhone: session.phone
    };

    if (requestId) query.request = requestId;
    if (status) query.status = status;
    if (minScore) query.score = { $gte: parseInt(minScore) };

    const matches = await VehicleMatch.find(query)
      .sort({ score: -1, createdAt: -1 }) // Best matches first
      .skip(skip)
      .limit(limit)
      .populate('car') // Populate car details to ensure we have fresh data if needed, though we have snapshot
      .populate('request'); // Populate request details

    const total = await VehicleMatch.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Matches API GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
