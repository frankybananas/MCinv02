import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import SoldCar from '@/models/SoldCar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check authentication and admin access
    const session = await requireSession(request);

    // Import User model to check role
    const User = (await import('@/models/User')).default;
    await connect();
    
    const user = await User.findOne({ phone: session.phone });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'soldDate';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 1 : -1;
    const searchQuery = url.searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build search filter
    const filter: any = {};
    if (searchQuery) {
      filter.$or = [
        { make: { $regex: searchQuery, $options: 'i' } },
        { carModel: { $regex: searchQuery, $options: 'i' } },
        { soldByUserName: { $regex: searchQuery, $options: 'i' } },
        { customerName: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    // Get sold cars
    const [soldCars, totalCount] = await Promise.all([
      SoldCar.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      SoldCar.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: soldCars,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + soldCars.length < totalCount,
      },
    });

  } catch (error: any) {
    console.error('Sold cars fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sold cars' },
      { status: 500 }
    );
  }
}
