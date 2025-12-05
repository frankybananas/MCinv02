import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { parseClientRequest } from '@/lib/ai/gemini-parser';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Ensure user is authenticated
    await requireSession(request);

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Text is required' },
        { status: 400 }
      );
    }

    const result = await parseClientRequest(text);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('AI Parse Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to parse request' },
      { status: 500 }
    );
  }
}
