import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import Car from '@/models/Car';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireSession(request);
    await connect();

    // Get cars with status in-stock or reserved that have images and are not marked as Do Not Advertise
    const cars = await Car.find({
      status: { $in: ['in-stock', 'reserved'] },
      images: { $exists: true, $not: { $size: 0 } },
      $or: [
        { doNotAdvertise: { $exists: false } },
        { doNotAdvertise: false }
      ]
    }).populate('images');

    // Return car data for marketing page
    const carData = cars.map(car => ({
      id: car._id.toString(),
      make: car.make,
      model: car.model,
      year: car.year,
      price: car.price,
      status: car.status,
      coverImage: car.images[car.coverImageIndex || 0]?.imageUrl || car.images[0]?.imageUrl
    }));

    return NextResponse.json({
      success: true,
      cars: carData
    });

  } catch (error) {
    console.error('Marketing cars fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cars for marketing' },
      { status: 500 }
    );
  }
}
