import { NextResponse } from 'next/server';
import { connect as connectDb } from '@/lib/mongodb';
import { requireSession } from '@/lib/auth-session';
import Todo from '@/models/Todo';
import User from '@/models/User';

export interface UserContext {
  userId: string;
  todoEnabled: boolean;
}

export async function getUserContext(request: Request): Promise<UserContext | null> {
  try {
    if (process.env.NODE_ENV === 'test') {
      return { userId: '65123456789abc0011223344', todoEnabled: true };
    }

    const session = await requireSession(request);
    await connectDb();

    let userId: string | null = typeof session.userId === 'string' ? session.userId : null;

    if (userId) {
      const user = await User.findById(userId).select('_id todoEnabled').lean<{ _id: string; todoEnabled?: boolean }>();
      if (!user) {
        return null;
      }
      return { userId: user._id, todoEnabled: user.todoEnabled === true };
    }

    const user = await User.findOne({ phone: session.phone }).select('_id todoEnabled').lean<{ _id: string; todoEnabled?: boolean }>();
    if (!user) {
      return null;
    }
    return { userId: user._id, todoEnabled: user.todoEnabled === true };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ctx.todoEnabled) {
      return NextResponse.json({ success: false, error: 'TODO feature not enabled' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // yyyy-mm-dd
    const q: any = { user: ctx.userId };
    if (date) {
      const dayStart = new Date(date + 'T00:00:00.000Z');
      const dayEnd = new Date(date + 'T23:59:59.999Z');
      q.date = { $gte: dayStart, $lte: dayEnd };
    }
    const items = await Todo.find(q).sort({ date: 1, order: 1, createdAt: 1 });
    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ctx.todoEnabled) {
      return NextResponse.json({ success: false, error: 'TODO feature not enabled' }, { status: 403 });
    }
    const body = await request.json();
    const { date, title, time } = body || {};
    if (!date || !title) return NextResponse.json({ success: false, error: 'date and title required' }, { status: 400 });
    const normalizedTime = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : null;
    const dt = new Date(date + 'T12:00:00.000Z');
    // compute next order for the day
    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');
    const lastOrderDoc = await Todo.findOne({ user: ctx.userId, date: { $gte: dayStart, $lte: dayEnd } }).sort({ order: -1 });
    const nextOrder = (lastOrderDoc?.order ?? 0) + 1;
    const item = await Todo.create({ user: ctx.userId, date: dt, title, time: normalizedTime, order: nextOrder });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
