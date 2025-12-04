import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car.js';
import Picture from '@/models/Picture';
import Delivery from '@/models/Delivery';
import Client from '@/models/Client.js';
import User from '@/models/User';
import WhatsAppGeneration from '@/models/WhatsAppGeneration';
import { requireSession, isPrivileged, verifyActiveSession, SessionData } from '@/lib/auth-session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CarUpdateData {
  [key: string]: string | number | boolean | string[] | null | undefined;
  status?: string;
  year?: number;
  price?: number;
  kilometers?: number;
  demo?: boolean;
  doNotAdvertise?: boolean;
  images?: string[];
  coverImageIndex?: number | null;
  vinImageIndex?: number | null;
}

/**
 * GET /api/cars/[id]
 * Fetch a single car by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireSession(request);
    await connectToDatabase();
    
    // Await params before accessing (Next.js 15 requirement)
    await request.blob();
    const { id } = await params;
    
    const car = await Car.findById(id).populate('owner').populate('images');
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    
    const carObject = car.toObject({ virtuals: true });
    return NextResponse.json({ success: true, data: carObject });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * PUT /api/cars/[id]
 * Update a car - supports both JSON (status updates) and FormData (full edits)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    
    const headersList = await headers();
    const userPhone = headersList.get('x-user-phone');
    const userName = headersList.get('x-user-name');
    const userRole = headersList.get('x-user-role');

    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';

    await connectToDatabase();

    if (contentType.includes('application/json')) {
      return handleJsonUpdate(request, id, userPhone, userName, userRole);
    } else if (contentType.includes('multipart/form-data')) {
      return handleFormDataUpdate(request, id, userPhone, userName);
    } else {
      return NextResponse.json({ success: false, message: 'Unsupported Content-Type' }, { status: 415 });
    }
  } catch (error) {
    console.error('Error in PUT /api/cars/[id]:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * Handle JSON updates (primarily status changes)
 */
async function handleJsonUpdate(
  request: NextRequest,
  id: string,
  userPhone: string | null,
  userName: string | null,
  userRole: string | null
): Promise<NextResponse> {
  const { status, clientId } = await request.json();

  if (!status || !['in-stock', 'coming', 'reserved', 'sold'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status provided' }, { status: 400 });
  }

  const carToUpdate = await Car.findById(id);
  if (!carToUpdate) {
    return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
  }

  const oldStatus = carToUpdate.status;

  // Only add a log entry if the status actually changed
  if (oldStatus !== status) {
    const auditEntry = {
      action: 'Car Status Update',
      details: `Status changed from '${oldStatus}' to '${status}'`,
      user: userName || userPhone || 'unknown',
    };
    carToUpdate.auditLog.push(auditEntry);

    // Track when car was marked as sold
    if (status === 'sold' && oldStatus !== 'sold') {
      carToUpdate.soldAt = new Date();
    }
    // Clear soldAt if status changes from sold to something else
    if (oldStatus === 'sold' && status !== 'sold') {
      carToUpdate.soldAt = null;
    }

    // Handle reservation side-effects
    if (status === 'reserved' && userPhone) {
      await handleReservation(id, carToUpdate, clientId, userPhone, userRole);
    }

    // If moving away from 'reserved', clean up deliveries and client links
    if (oldStatus === 'reserved' && status !== 'reserved') {
      await cleanupReservation(id, carToUpdate);
    }
  }

  carToUpdate.status = status;
  const updatedCar = await carToUpdate.save();
  await updatedCar.populate('images');

  return NextResponse.json({ success: true, data: updatedCar.toObject({ virtuals: true }) });
}

/**
 * Handle reservation creation and client linking
 */
async function handleReservation(
  carId: string,
  carToUpdate: typeof Car.prototype,
  clientId: string | undefined,
  userPhone: string,
  userRole: string | null
): Promise<void> {
  try {
    const user = await User.findOne({ phone: userPhone });
    if (!user) return;

    let linkedClientId: string | null = null;
    
    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      let canLink = false;
      if (userRole === 'admin' || userRole === 'manager') {
        canLink = true;
      } else {
        const owned = await Client.findOne({ _id: clientId, createdByPhone: userPhone });
        canLink = !!owned;
      }
      
      if (canLink) {
        linkedClientId = clientId;
        carToUpdate.owner = clientId;
        await Client.updateOne({ _id: clientId }, { $addToSet: { cars: carId } });
      }
    }

    // Create or update delivery record
    const deliveryResult = await Delivery.findOneAndUpdate(
      { car: carId, salesperson: user._id },
      { 
        $setOnInsert: { car: carId, salesperson: user._id }, 
        ...(linkedClientId ? { client: linkedClientId } : {}) 
      },
      { new: true, upsert: true }
    );
    
    if (linkedClientId && deliveryResult && 
        (!deliveryResult.client || String(deliveryResult.client) !== String(linkedClientId))) {
      deliveryResult.client = linkedClientId;
      await deliveryResult.save();
    }
  } catch (deliveryError) {
    console.error('Failed to create delivery record:', deliveryError);
    // Don't fail the status update if delivery creation fails
  }
}

/**
 * Clean up when moving away from reserved status
 */
async function cleanupReservation(
  carId: string,
  carToUpdate: typeof Car.prototype
): Promise<void> {
  try {
    await Delivery.deleteMany({ car: carId });
  } catch (cleanupErr) {
    console.error('Failed to remove deliveries after status change:', cleanupErr);
  }

  try {
    if (carToUpdate.owner) {
      await Client.updateOne({ _id: carToUpdate.owner }, { $pull: { cars: carId } });
    }
    carToUpdate.owner = undefined;
  } catch (unlinkErr) {
    console.error('Failed to unlink car from client after leaving reserved:', unlinkErr);
  }
}

/**
 * Handle FormData updates (full car edits with images)
 */
async function handleFormDataUpdate(
  request: NextRequest,
  id: string,
  userPhone: string | null,
  userName: string | null
): Promise<NextResponse> {
  const data = await request.formData();
  const updateData: CarUpdateData = {};
  const newImageIds: string[] = [];

  // Handle new image uploads
  const imageFiles = data.getAll('images') as File[];
  const imageTitles = data.getAll('imageTitles');
  
  for (const [index, file] of imageFiles.entries()) {
    if (typeof file === 'object' && file.name) {
      const arrayBuf = await file.arrayBuffer();
      const input = Buffer.from(arrayBuf);
      const sharp = (await import('sharp')).default;
      
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

      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: mediumKey,
        Body: medium,
        ContentType: 'image/webp',
        CacheControl,
      }));
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
        imageUrl,
        thumbnailUrl,
        title: imageTitles[index] || file.name,
      });
      await newPicture.save();
      newImageIds.push(newPicture._id.toString());
    }
  }

  // Handle existing images to keep
  const existingImageIdsRaw = data.getAll('existingImages').map(v => String(v));
  const existingImageIds = existingImageIdsRaw.filter(imgId => mongoose.Types.ObjectId.isValid(imgId));

  // Handle other form fields
  for (const [key, value] of data.entries()) {
    if (['images', 'existingImages', 'imageTitles', 'imageOrder', 'coverImageIndex', 'vinImageIndex'].includes(key)) {
      continue;
    }
    
    if (['year', 'price', 'kilometers'].includes(key)) {
      const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
      if (!Number.isNaN(num)) {
        updateData[key] = num;
      }
    } else if (['demo', 'doNotAdvertise'].includes(key)) {
      updateData[key] = String(value) === 'true';
    } else {
      updateData[key] = String(value);
    }
  }

  // Handle image role indices
  const coverImageIndexRaw = data.get('coverImageIndex');
  const vinImageIndexRaw = data.get('vinImageIndex');
  
  if (coverImageIndexRaw !== null && coverImageIndexRaw !== undefined) {
    const coverIdx = parseInt(String(coverImageIndexRaw), 10);
    updateData.coverImageIndex = !Number.isNaN(coverIdx) ? coverIdx : null;
  } else {
    updateData.coverImageIndex = null;
  }
  
  if (vinImageIndexRaw !== null && vinImageIndexRaw !== undefined) {
    const vinIdx = parseInt(String(vinImageIndexRaw), 10);
    updateData.vinImageIndex = !Number.isNaN(vinIdx) ? vinIdx : null;
  } else {
    updateData.vinImageIndex = null;
  }

  // Combine image lists respecting client-provided order
  const orderMarkers = data.getAll('imageOrder');
  if (orderMarkers && orderMarkers.length > 0) {
    const finalOrdered: string[] = [];
    for (const marker of orderMarkers) {
      const m = String(marker);
      if (m.startsWith('new:')) {
        const idxStr = m.split(':')[1];
        const idx = parseInt(idxStr, 10);
        if (!Number.isNaN(idx) && newImageIds[idx]) {
          finalOrdered.push(newImageIds[idx]);
        }
      } else if (existingImageIds.includes(m) && mongoose.Types.ObjectId.isValid(m)) {
        finalOrdered.push(m);
      }
    }
    // Ensure no images are lost
    const remaining = [...existingImageIds, ...newImageIds].filter(imgId => !finalOrdered.includes(imgId));
    updateData.images = [...finalOrdered, ...remaining].filter(imgId => mongoose.Types.ObjectId.isValid(imgId));
  } else {
    updateData.images = [...existingImageIds, ...newImageIds].filter(imgId => mongoose.Types.ObjectId.isValid(imgId));
  }

  const carToUpdate = await Car.findById(id);
  if (!carToUpdate) {
    return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
  }

  // Log changes
  const oldData = carToUpdate.toObject();
  const changes: string[] = [];

  for (const key in updateData) {
    if (key === 'images') continue;
    
    const oldValue = oldData[key];
    const newValue = updateData[key];
    
    const oldIsEmpty = oldValue === null || oldValue === undefined || oldValue === '';
    const newIsEmpty = newValue === null || newValue === undefined || newValue === '';
    
    if (oldIsEmpty && newIsEmpty) continue;
    
    if (String(oldValue) !== String(newValue)) {
      changes.push(`'${key}' from '${oldValue || 'N/A'}' to '${newValue}'`);
    }
  }

  // Check for image changes
  const oldImageIds = Array.isArray(oldData.images) ? oldData.images.map((img: { toString: () => string }) => img.toString()) : [];
  const newImageIdsCombined = updateData.images || [...existingImageIds, ...newImageIds];
  if (JSON.stringify(oldImageIds) !== JSON.stringify(newImageIdsCombined)) {
    changes.push('images were updated');
  }

  if (changes.length > 0) {
    carToUpdate.auditLog.push({
      action: 'Car Details Update',
      details: `Updated fields: ${changes.join(', ')}`,
      user: userName || userPhone || 'unknown',
    });
  }

  Object.assign(carToUpdate, updateData);
  const updatedCar = await carToUpdate.save();
  await updatedCar.populate('images');

  return NextResponse.json({ success: true, data: updatedCar.toObject({ virtuals: true }) });
}

/**
 * DELETE /api/cars/[id]
 * Delete a car and all associated data
 * Requires: admin or manager role
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    await connectToDatabase();
    
    if (!isPrivileged(session)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    await request.blob();
    const { id } = await params;

    const car = await Car.findById(id).populate('images');
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }

    // Collect picture ids and keys to delete from R2
    const pictures = Array.isArray(car.images) ? car.images : [];
    const pictureIds = pictures.map((p: { _id?: mongoose.Types.ObjectId }) => p._id).filter(Boolean);

    // Compute object keys from URLs
    const keys: string[] = [];
    const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    
    for (const pic of pictures) {
      const img = (pic && pic.imageUrl) ? String(pic.imageUrl) : '';
      const thumb = (pic && pic.thumbnailUrl) ? String(pic.thumbnailUrl) : '';
      
      for (const url of [img, thumb]) {
        if (!url) continue;
        if (publicBase && url.startsWith(publicBase + '/')) {
          keys.push(url.substring(publicBase.length + 1));
        } else {
          const idx = url.indexOf('pictures/');
          if (idx >= 0) keys.push(url.substring(idx));
        }
      }
    }

    // Delete R2 objects (best-effort)
    try {
      const { s3 } = await import('@/lib/s3');
      const Bucket = process.env.R2_BUCKET_NAME;
      if (Bucket) {
        await Promise.all(
          keys.map(async (Key) => {
            try {
              await s3.send(new DeleteObjectCommand({ Bucket, Key }));
            } catch (e) {
              console.error('Failed to delete R2 object', Key, e);
            }
          })
        );
      }
    } catch (e) {
      console.error('R2 deletion skipped/failed:', e);
    }

    // Delete Picture documents
    if (pictureIds.length > 0) {
      try {
        await Picture.deleteMany({ _id: { $in: pictureIds } });
      } catch (e) {
        console.error('Failed to delete Picture docs for car', id, e);
      }
    }

    // Remove deliveries
    try {
      await Delivery.deleteMany({ car: id });
    } catch (e) {
      console.error('Failed to delete Delivery records for car', id, e);
    }

    // Unlink from client
    try {
      if (car.owner) {
        await Client.updateOne({ _id: car.owner }, { $pull: { cars: id } });
      }
    } catch (e) {
      console.error('Failed to unlink car from client', id, e);
    }

    // Update WhatsAppGeneration records
    try {
      await WhatsAppGeneration.updateMany(
        { carIds: { $in: [String(id)] } },
        { $pull: { carIds: String(id) } }
      );
    } catch (e) {
      console.error('Failed to update WhatsAppGeneration records for car', id, e);
    }

    // Delete the car
    await Car.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('Error in DELETE /api/cars/[id]:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
