import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';
import VehicleMatch from '@/models/VehicleMatch';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await connectToDatabase();

    // Aggregate matches by car for this user
    // We exclude dismissed matches from the count? Usually yes.
    const counts = await VehicleMatch.aggregate([
      { $match: { createdByPhone: session.phone, status: { $ne: 'dismissed' } } },
      { $group: { _id: '$car', count: { $sum: 1 } } }
    ]);

    const countMap: Record<string, number> = {};
    counts.forEach(c => {
      if (c._id) countMap[c._id.toString()] = c.count;
    });

    return NextResponse.json({ success: true, data: countMap });
  } catch (error) {
    console.error('Match Counts API Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch match counts' }, { status: 500 });
  }
}
