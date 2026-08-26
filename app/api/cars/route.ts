import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import Picture from '@/models/Picture';
import { requireSession, verifyActiveSession } from '@/lib/auth-session';

interface CarFormData {
  [key: string]: string | number | boolean | undefined;
  year?: number;
  price?: number;
  kilometers?: number;
  demo?: boolean;
  doNotAdvertise?: boolean;
  make?: string;
  model?: string;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/gif',
]);

const validateImageFile = (file: File): { message: string; status: number } | null => {
  if (!file || typeof file.size !== 'number') {
    return { message: 'Invalid image upload.', status: 400 };
  }
  if (file.size <= 0) {
    return { message: 'Empty image upload.', status: 400 };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { message: `Image too large. Max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`, status: 413 };
  }
  if (!file.type || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { message: `Unsupported image type: ${file.type || 'unknown'}.`, status: 415 };
  }
  return null;
};

/**
 * GET /api/cars
 * Fetch all cars (requires authentication)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireSession(request);
    await connectToDatabase();
    
    const cars = await Car.find({})
      .sort({ createdAt: -1 })
      .populate('owner')
      .populate('images');
    
    const formattedCars = cars.map(car => ({
      ...car.toObject(),
      id: car._id.toString(),
    }));
    
    return NextResponse.json({ success: true, data: formattedCars });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cars.';
    console.error('Cars API GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cars.', error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cars
 * Create a new car with optional images
 * Requires: admin, manager, or recon role
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    
    // Role check: only admin/manager/recon can create cars
    const allowedRoles = ['admin', 'manager', 'recon'];
    if (!session.role || !allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }
    
    await connectToDatabase();
    
    const headersList = await headers();
    const userPhone = headersList.get('x-user-phone');
    const userName = headersList.get('x-user-name');
    
    // Ensure indexes are in sync (applies partial unique index for licensePlate)
    try {
      await Car.syncIndexes();
      // Extra: if existing index is incompatible, drop and recreate with partial filter
      const indexes = await Car.collection.indexes();
      const lp = indexes.find((i) => i.name === 'licensePlate_1') as {
        name?: string;
        unique?: boolean;
        partialFilterExpression?: { licensePlate?: unknown };
      } | undefined;
      const needsRecreate = lp && lp.unique && (!lp.partialFilterExpression || !lp.partialFilterExpression.licensePlate);
      if (needsRecreate) {
        try {
          await Car.collection.dropIndex('licensePlate_1');
        } catch (e) {
          console.warn('dropIndex warning:', e instanceof Error ? e.message : e);
        }
        try {
          await Car.collection.createIndex(
            { licensePlate: 1 },
            { 
              name: 'licensePlate_1', 
              unique: true, 
              partialFilterExpression: { licensePlate: { $type: 'string', $ne: '' } } 
            }
          );
        } catch (e) {
          console.warn('createIndex warning:', e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('Car.syncIndexes warning:', e instanceof Error ? e.message : e);
    }
    
    const data = await request.formData();
    const carData: CarFormData = {};
    const files = data.getAll('images') as File[];
    const imageFiles = files.filter((file) => file && file.size > 0);

    for (const file of imageFiles) {
      const error = validateImageFile(file);
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
      }
    }

    for (const [key, value] of data.entries()) {
      if (key === 'images') continue;
      
      if (['year', 'price', 'kilometers'].includes(key)) {
        const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
        if (!Number.isNaN(num)) {
          carData[key as 'year' | 'price' | 'kilometers'] = num;
        }
      } else if (['demo', 'doNotAdvertise'].includes(key)) {
        carData[key as 'demo' | 'doNotAdvertise'] = String(value) === 'true';
      } else {
        carData[key] = String(value);
      }
    }

    // Create car document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newCar: any;
    try {
      newCar = await Car.create(carData);
    } catch (err) {
      // Handle duplicate key for licensePlate when it's null/empty due to legacy index
      const mongoError = err as { code?: number; message?: string };
      if (mongoError.code === 11000 && mongoError.message?.includes('licensePlate')) {
        // Retry without licensePlate if none was provided
        if (!('licensePlate' in carData) || carData.licensePlate == null || carData.licensePlate === '') {
          const clone = { ...carData };
          delete clone.licensePlate;
          try {
            newCar = await Car.create(clone);
          } catch {
            throw err; // rethrow original
          }
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    
    // Record creation in audit log
    newCar.auditLog.push({
      action: 'Car Created',
      details: 'New car record created',
      user: userName || userPhone || 'unknown',
    });

    // Process image uploads
    if (imageFiles.length > 0) {
      const newPictureIds = await Promise.all(
        imageFiles
          .map(async (file: File) => {
            const arrayBuf = await file.arrayBuffer();
            const input = Buffer.from(arrayBuf);
            
            // Lazy-load sharp only on the server
            const sharp = (await import('sharp')).default;

            // Create medium (hero) variant ~1600px and thumbnail ~320px
            const medium = await sharp(input)
              .rotate()
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer();
            const thumb = await sharp(input)
              .rotate()
              .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer();

            const idBase = uuidv4();
            const mediumKey = `pictures/${idBase}_m.webp`;
            const thumbKey = `pictures/${idBase}_t.webp`;

            const { s3 } = await import('@/lib/s3');
            const CacheControl = 'public, max-age=31536000, immutable';

            // Upload medium
            await s3.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: mediumKey,
              Body: medium,
              ContentType: 'image/webp',
              CacheControl,
            }));
            
            // Upload thumb
            await s3.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: thumbKey,
              Body: thumb,
              ContentType: 'image/webp',
              CacheControl,
            }));

            const imageUrl = `${process.env.R2_PUBLIC_URL}/${mediumKey}`;
            const thumbnailUrl = `${process.env.R2_PUBLIC_URL}/${thumbKey}`;

            const newPicture = new Picture({
              title: `${newCar.make} ${newCar.model}`,
              imageUrl,
              thumbnailUrl,
              car: newCar._id,
            });
            await newPicture.save();
            return newPicture._id;
          })
      );
      
      newCar.images.push(...newPictureIds);
      await newCar.save();
    } else {
      // Ensure audit entry persists even when there are no images uploaded
      await newCar.save();
    }

    const populatedCar = await Car.findById(newCar._id).populate('owner').populate('images');
    return NextResponse.json(
      { success: true, data: populatedCar?.toObject({ virtuals: true }) },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cars API POST Error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
