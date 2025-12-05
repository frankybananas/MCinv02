import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';
import VehicleMatch from '@/models/VehicleMatch';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await connectToDatabase();

    // Await params before accessing (Next.js 15 requirement)
    await request.blob();
    const { id } = await params;

    const match = await VehicleMatch.findOne({
      _id: id,
      createdByPhone: session.phone
    })
    .populate('car')
    .populate('request');

    if (!match) {
      return NextResponse.json({ success: false, message: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: match });
  } catch (error) {
    console.error('Match API GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch match' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await connectToDatabase();

    // Await params before accessing (Next.js 15 requirement)
    // We also read body later, so we clone if we needed to read blob earlier, but here we can read body first?
    // Wait, app/api/cars/[id] does await request.blob() first.
    // But if I read blob, can I read json later?
    // "await request.clone().blob()" might be safer if body is needed.
    // But request.blob() consumes the body.
    // Let's use clone().
    
    await request.clone().blob();
    const { id } = await params;

    const body = await request.json();
    const { status, dismissReason } = body;

    const update: any = {};
    if (status) {
        update.status = status;
        if (status === 'viewed' && !update.viewedAt) update.viewedAt = new Date();
        if (status === 'dismissed') {
            update.dismissedAt = new Date();
            if (dismissReason) update.dismissReason = dismissReason;
        }
        if (status === 'notified' && !update.notifiedAt) update.notifiedAt = new Date();
    }

    const match = await VehicleMatch.findOneAndUpdate(
      { _id: id, createdByPhone: session.phone },
      { $set: update },
      { new: true }
    );

    if (!match) {
      return NextResponse.json({ success: false, message: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: match });
  } catch (error) {
    console.error('Match API PATCH Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update match' },
      { status: 500 }
    );
  }
}
