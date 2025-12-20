import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import { sanitizeForRegex, validatePagination } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    await connect();

    const AuditLog = (await import('@/models/AuditLog')).default;

    const url = new URL(request.url);
    const eventType = url.searchParams.get('eventType') || '';
    const query = url.searchParams.get('q') || '';

    const { page, limit, skip } = validatePagination(url.searchParams.get('page'), url.searchParams.get('limit'), 100);

    const filter: any = {};

    if (eventType && eventType !== 'all') {
      filter.eventType = eventType;
    }

    if (query) {
      const safe = sanitizeForRegex(query);
      filter.$or = [
        { phone: { $regex: safe, $options: 'i' } },
        { userId: { $regex: safe, $options: 'i' } },
        { 'metadata.targetUserId': { $regex: safe, $options: 'i' } },
        { 'metadata.targetPhone': { $regex: safe, $options: 'i' } },
        { 'metadata.actor': { $regex: safe, $options: 'i' } },
      ];
    }

    const [rows, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + rows.length < totalCount,
      },
    });
  } catch (error: any) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
