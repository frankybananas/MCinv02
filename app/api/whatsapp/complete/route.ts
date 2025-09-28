import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import WhatsAppGeneration from '@/models/WhatsAppGeneration';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireSession(request);
    const { generationId, status, errorMessage } = await request.json();

    await connect();

    const generation = await WhatsAppGeneration.findOneAndUpdate(
      { _id: generationId, user: userId },
      {
        status,
        errorMessage,
        completedAt: status === 'completed' ? new Date() : undefined
      },
      { new: true }
    );

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('WhatsApp completion error:', error);
    return NextResponse.json(
      { error: 'Failed to update generation status' },
      { status: 500 }
    );
  }
}
