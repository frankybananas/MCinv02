import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    await connect();

    const Car = (await import('@/models/Car')).default;
    const Client = (await import('@/models/Client')).default;
    const Delivery = (await import('@/models/Delivery')).default;
    const Picture = (await import('@/models/Picture')).default;

    const [carStatusCounts, totalClients, totalDeliveries, pictureStats] = await Promise.all([
      Car.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Client.countDocuments({}),
      Delivery.countDocuments({}),
      Picture.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalBytes: { $sum: { $ifNull: ['$metadata.size', 0] } },
          },
        },
      ]),
    ]);

    const carsByStatus: Record<string, number> = {
      'in-stock': 0,
      coming: 0,
      reserved: 0,
      sold: 0,
    };

    for (const row of carStatusCounts as Array<{ _id?: string; count?: number }>) {
      const key = typeof row?._id === 'string' ? row._id : null;
      if (!key) continue;
      const count = typeof row?.count === 'number' ? row.count : 0;
      carsByStatus[key] = count;
    }

    const totalCars = Object.values(carsByStatus).reduce((sum, n) => sum + n, 0);

    const pictureAgg = Array.isArray(pictureStats) ? pictureStats[0] : null;
    const totalImages = typeof pictureAgg?.count === 'number' ? pictureAgg.count : 0;
    const totalImageBytes = typeof pictureAgg?.totalBytes === 'number' ? pictureAgg.totalBytes : 0;

    return NextResponse.json({
      success: true,
      cars: {
        total: totalCars,
        byStatus: carsByStatus,
      },
      clients: {
        total: totalClients,
      },
      deliveries: {
        total: totalDeliveries,
      },
      images: {
        total: totalImages,
        totalSizeBytes: totalImageBytes,
        totalSizeMB: Number((totalImageBytes / (1024 * 1024)).toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('System metrics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}
