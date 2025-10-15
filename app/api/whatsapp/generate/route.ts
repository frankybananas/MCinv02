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

    // Filter cars that have valid populated images
    const validCars = cars.filter(car => {
      return car.images && 
             Array.isArray(car.images) && 
             car.images.length > 0 &&
             car.images[0] &&
             typeof car.images[0] === 'object' &&
             'imageUrl' in car.images[0];
    });

    if (validCars.length === 0) {
      return NextResponse.json(
        { error: 'No cars with valid images found for generation' },
        { status: 404 }
      );
    }

    // Create generation log
    const generation = new WhatsAppGeneration({
      user: userId,
      carCount: validCars.length,
      carIds: validCars.map(car => car._id.toString()),
      status: 'pending'
    });
    await generation.save();

    // Return car data for client-side image generation
    const carData = validCars.map(car => {
      // Get the first image from the populated images array
      const firstImage = car.images[0];
      const coverImage = firstImage && typeof firstImage === 'object' && 'imageUrl' in firstImage
        ? firstImage.imageUrl
        : '';

      return {
        id: car._id.toString(),
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        coverImage
      };
    });

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
