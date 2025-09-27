import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connect as connectDb } from '@/lib/mongodb';
import Todo from '@/models/Todo';

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie');
  const token = parseCookie(cookieHeader, 'session_token');
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) return null;
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    let userId: any = (payload as any).userId;
    if (typeof userId !== 'string') {
      try {
        if (userId?.data && Array.isArray(userId.data)) {
          userId = Buffer.from(userId.data).toString('utf8');
        } else if (ArrayBuffer.isView(userId)) {
          userId = Buffer.from(userId as Uint8Array).toString('utf8');
        } else if (typeof userId?.toString === 'function') {
          userId = userId.toString();
        }
      } catch {}
    }
    if (typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId)) {
      return userId;
    }
    return null;
  } catch {
    return null;
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await connectDb();
    const body = await request.json();
    const { title, date, order, time } = body || {};
    const update: any = {};
    if (typeof title === 'string') update.title = title;
    if (typeof date === 'string') update.date = new Date(date + 'T12:00:00.000Z');
    if (typeof time === 'string' || time === null) {
      if (typeof time === 'string' && !/^\d{2}:\d{2}$/.test(time)) {
        return NextResponse.json({ success: false, error: 'Invalid time format' }, { status: 400 });
      }
      update.time = time ?? null;
    }
    if (typeof order === 'number' && Number.isFinite(order)) update.order = order;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'No updatable fields' }, { status: 400 });
    }
    const item = await Todo.findOneAndUpdate({ _id: params.id, user: userId }, { $set: update }, { new: true });
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: item });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await connectDb();
    const res = await Todo.findOneAndDelete({ _id: params.id, user: userId });
    if (!res) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: { _id: params.id } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
