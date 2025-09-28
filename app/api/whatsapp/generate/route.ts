import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import Car from '@/models/Car';
import WhatsAppGeneration from '@/models/WhatsAppGeneration';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireSession(request);
    await connect();

    // Get all in-stock cars with images
    const cars = await Car.find({ 
      status: 'in-stock',
      images: { $exists: true, $not: { $size: 0 } }
    }).populate('images');

    if (cars.length === 0) {
      return NextResponse.json(
        { error: 'No in-stock cars with images found' },
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
    const carData = cars.map(car => {
      // Get cover image - check if coverImageIndex exists and is valid
      let coverImage = null;
      if (car.images && car.images.length > 0) {
        const coverIndex = car.coverImageIndex !== null && car.coverImageIndex !== undefined 
          ? car.coverImageIndex 
          : 0;
        const imageAtIndex = car.images[coverIndex];
        coverImage = imageAtIndex?.imageUrl || car.images[0]?.imageUrl;
      }

      return {
        id: car._id.toString(),
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        coverImage
      };
    }).filter(car => car.coverImage); // Only include cars with valid cover images

    if (carData.length === 0) {
      return NextResponse.json(
        { error: 'No cars with valid cover images found' },
        { status: 404 }
      );
    }

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
