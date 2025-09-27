import { NextResponse } from 'next/server';
import { connect as connectDb } from '@/lib/mongodb';
import Todo from '@/models/Todo';
import { getUserContext } from '../route';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getUserContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ctx.todoEnabled) {
      return NextResponse.json({ success: false, error: 'TODO feature not enabled' }, { status: 403 });
    }
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
    const item = await Todo.findOneAndUpdate({ _id: params.id, user: ctx.userId }, { $set: update }, { new: true });
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: item });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getUserContext(request);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ctx.todoEnabled) {
      return NextResponse.json({ success: false, error: 'TODO feature not enabled' }, { status: 403 });
    }
    await connectDb();
    const res = await Todo.findOneAndDelete({ _id: params.id, user: ctx.userId });
    if (!res) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: { _id: params.id } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
