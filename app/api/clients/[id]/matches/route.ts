import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';
import VehicleMatch from '@/models/VehicleMatch';
import ClientRequest from '@/models/ClientRequest';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await connectToDatabase();

    // Consume request body as per standard (even if GET, to handle params safety in some contexts)
    await request.blob();
    const { id } = await params;

    // Find all requests for this client
    const requests = await ClientRequest.find({ client: id }).select('_id');
    const requestIds = requests.map(r => r._id);

    // Find matches for these requests
    const matches = await VehicleMatch.find({
      request: { $in: requestIds },
      createdByPhone: session.phone
    })
    .sort({ score: -1, createdAt: -1 })
    .populate('car')
    .populate('request');

    return NextResponse.json({ success: true, data: matches });
  } catch (error) {
    console.error('Client Matches API GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
