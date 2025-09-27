import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';

type NotificationAction = 'read' | 'unread' | 'done' | 'undone';

interface RequestPayload {
  notificationId?: unknown;
  action?: unknown;
}

function normalizeAction(value: unknown): NotificationAction | null {
  if (typeof value !== 'string') return null;
  const lowered = value.toLowerCase();
  if (lowered === 'read' || lowered === 'unread' || lowered === 'done' || lowered === 'undone') {
    return lowered;
  }
  return null;
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const phone = session.phone;
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestPayload;
    const notificationId = normalizeId(body.notificationId);
    const action = normalizeAction(body.action);

    if (!notificationId || !action) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    await connectDb();

    const update: Record<string, unknown> = {};
    if (action === 'read') {
      update.$addToSet = { notificationsReadIds: notificationId };
    } else if (action === 'unread') {
      update.$pull = { notificationsReadIds: notificationId };
    } else if (action === 'done') {
      update.$addToSet = { notificationsDoneIds: notificationId };
      update.$pull = { ...(update.$pull as Record<string, unknown> | undefined), notificationsReadIds: notificationId };
    } else if (action === 'undone') {
      update.$pull = { notificationsDoneIds: notificationId };
    }

    const updatedUser = await User.findOneAndUpdate(
      { phone },
      update,
      {
        new: true,
        select: 'notificationsReadIds notificationsDoneIds notificationsLastSeenAt',
      }
    );

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        readIds: Array.isArray(updatedUser.notificationsReadIds)
          ? updatedUser.notificationsReadIds.map(String)
          : [],
        doneIds: Array.isArray(updatedUser.notificationsDoneIds)
          ? updatedUser.notificationsDoneIds.map(String)
          : [],
        notificationsLastSeenAt: updatedUser.notificationsLastSeenAt ?? null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
