import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import Car from '@/models/Car';
import WhatsAppGeneration from '@/models/WhatsAppGeneration';

export async function POST(request: NextRequest) {
  try {
    const trace = `whatsgen:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,8)}`;
    const { userId, phone } = await requireSession(request);
    const { selectedCarIds } = await request.json();
    console.log(trace, 'request', { count: Array.isArray(selectedCarIds) ? selectedCarIds.length : 0 });

    if (!selectedCarIds || !Array.isArray(selectedCarIds) || selectedCarIds.length === 0) {
      return NextResponse.json(
        { error: 'No cars selected for generation' },
        { status: 400 }
      );
    }

    await connect();
    console.log(trace, 'db:connected');

    // Validate and normalize userId -> ObjectId
    const { Types } = (await import('mongoose'));
    let effectiveUserId = userId as string | null;
    if (!effectiveUserId && phone) {
      // Backward compatibility: derive userId from phone when absent in JWT
      let e164 = phone;
      try {
        const lib = await import('libphonenumber-js');
        const parsed = lib.default(phone, 'ZA');
        if (parsed && parsed.isValid()) {
          e164 = parsed.format('E.164');
        }
      } catch {}

      const candidates = Array.from(new Set([
        e164,
        phone,
        phone.replace(/\s+/g, ''),
        phone.startsWith('+') ? phone.slice(1) : phone,
      ].filter(Boolean)));

      const { default: UserModel } = await import('@/models/User');
      const found = await UserModel.findOne({ phone: { $in: candidates } }).select({ _id: 1 }).lean();
      if (found?._id) {
        effectiveUserId = String(found._id);
      }
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userObjectId;
    try {
      userObjectId = new Types.ObjectId(effectiveUserId);
    } catch {
      return NextResponse.json(
        { error: 'Invalid user id' },
        { status: 400 }
      );
    }
    console.log(trace, 'session:userId:ok');

    // Dedupe IDs
    const uniqueIds = Array.from(new Set(selectedCarIds));

    // Get selected cars attempting populate first (for Picture refs),
    // but remain compatible with schemas where images are string URLs
    let cars: any[] = [];
    try {
      cars = await Car.find({
        _id: { $in: uniqueIds },
        images: { $exists: true, $not: { $size: 0 } }
      }).populate('images');
    } catch (e) {
      console.error(trace, 'populate_failed', e);
      cars = await Car.find({
        _id: { $in: uniqueIds },
        images: { $exists: true, $not: { $size: 0 } }
      });
    }
    console.log(trace, 'cars:fetched', { count: cars.length });

    if (cars.length === 0) {
      return NextResponse.json(
        { error: 'No valid cars found for generation' },
        { status: 404 }
      );
    }

    // Filter cars that have a usable cover image: either a string URL
    // or a populated object with imageUrl
    const validCars = cars.filter((car) => {
      const first = car?.images?.[0];
      if (!first) return false;
      if (typeof first === 'string') return first.length > 0;
      return typeof first === 'object' && 'imageUrl' in first && typeof first.imageUrl === 'string';
    });
    console.log(trace, 'cars:valid', { count: validCars.length });

    if (validCars.length === 0) {
      return NextResponse.json(
        { error: 'No cars with valid images found for generation' },
        { status: 404 }
      );
    }

    // Create generation log
    const generation = new WhatsAppGeneration({
      user: userObjectId,
      carCount: validCars.length,
      carIds: validCars.map(car => car._id.toString()),
      status: 'pending'
    });
    await generation.save();
    console.log(trace, 'generation:saved', { id: String(generation._id), carCount: generation.carCount });

    // Return car data for client-side image generation
    const carData = validCars.map((car) => {
      let coverImage = '';
      let allImages: string[] = [];
      try {
        const idxRaw = (car as any).coverImageIndex;
        const idx = typeof idxRaw === 'number' && idxRaw >= 0 ? idxRaw : 0;
        const candidate = car.images?.[idx] ?? car.images?.[0];
        if (typeof candidate === 'string') {
          coverImage = candidate;
        } else if (candidate && typeof candidate === 'object' && 'imageUrl' in candidate) {
          coverImage = (candidate as any).imageUrl || '';
        }
        
        // Get all images for thumbnails
        if (car.images && Array.isArray(car.images)) {
          allImages = car.images.map((img: any) => {
            if (typeof img === 'string') {
              return img;
            } else if (img && typeof img === 'object' && 'imageUrl' in img) {
              return img.imageUrl || '';
            }
            return '';
          }).filter((url: string) => url !== '');
        }
      } catch {}

      return {
        id: car._id.toString(),
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        kilometers: car.kilometers,
        transmission: car.transmission,
        fuelType: car.fuelType,
        coverImage,
        allImages
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
