import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import Car from '@/models/Car';
import WhatsAppGeneration from '@/models/WhatsAppGeneration';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireSession(request);
    const { selectedCarIds } = await request.json();

    if (!selectedCarIds || !Array.isArray(selectedCarIds) || selectedCarIds.length === 0) {
      return NextResponse.json(
        { error: 'No cars selected for generation' },
        { status: 400 }
      );
    }

    await connect();

    // Get selected cars with images
    const cars = await Car.find({
      _id: { $in: selectedCarIds },
      images: { $exists: true, $not: { $size: 0 } }
    }).populate('images');

    if (cars.length === 0) {
      return NextResponse.json(
        { error: 'No valid cars found for generation' },
        { status: 404 }
      );
    }

    // Create generation log
    const generation = new WhatsAppGeneration({
      user: userId,
      carCount: cars.length,
      carIds: cars.map(car => car._id.toString()),
      status: 'pending'
    });
    await generation.save();

    // Return car data for client-side image generation
    const carData = cars.map(car => ({
      id: car._id.toString(),
      make: car.make,
      model: car.model,
      year: car.year,
      price: car.price,
      coverImage: car.images[car.coverImageIndex || 0]?.imageUrl || car.images[0]?.imageUrl
    }));

    return NextResponse.json({
      success: true,
      generationId: generation._id,
      cars: carData
    });

  } catch (error) {
    console.error('WhatsApp generation error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare image generation' },
      { status: 500 }
    );
  }
}
