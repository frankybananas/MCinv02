import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import Car from '@/models/Car.js';
import Picture from '@/models/Picture';
import Session from '@/models/Session'; // Import Session model
import Delivery from '@/models/Delivery.ts';
import Client from '@/models/Client.js';
import User from '@/models/User.ts';
import WhatsAppGeneration from '@/models/WhatsAppGeneration.ts';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { requireSession, isPrivileged } from '@/lib/auth-session';

// GET handler
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    await request.blob();
    const { id } = await params;
    const car = await Car.findById(id).populate('owner').populate('images');
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    const carObject = car.toObject({ virtuals: true });
    return NextResponse.json({ success: true, data: carObject });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}



// PUT handler now supports both JSON (for status updates) and formData (for full edits)
export async function PUT(request, { params }) {
  const headersList = await headers();
  const userPhone = headersList.get('x-user-phone');
  const userName = headersList.get('x-user-name');
  const userRole = headersList.get('x-user-role');

  const { id } = await params;

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Handle JSON for status update
      const { status, clientId } = await request.json();

      if (!status || !['in-stock', 'coming', 'reserved', 'sold'].includes(status)) {
        return NextResponse.json({ success: false, message: 'Invalid status provided' }, { status: 400 });
      }

            const carToUpdate = await Car.findById(id);

      if (!carToUpdate) {
        return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
      }

      const oldStatus = carToUpdate.status;

      // Only add a log entry if the status actually changed.
      if (oldStatus !== status) {
        const auditEntry = {
          action: 'Car Status Update',
          details: `Status changed from '${oldStatus}' to '${status}'`,
          user: userName || userPhone || 'unknown', // Prefer name, fallback to phone
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
          try {
            // Find user by phone to get userId
            const user = await User.findOne({ phone: userPhone });

            if (user) {
              // Optionally link client if provided and allowed
              let linkedClientId = null;
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
                  // Set car owner and add car to client's list if not present
                  console.log(`[CAR RESERVATION] Linking car ${id} to client ${clientId}`);
                  carToUpdate.owner = clientId;
                  const clientUpdateResult = await Client.updateOne(
                    { _id: clientId },
                    { $addToSet: { cars: id } }
                  );
                  console.log(`[CAR RESERVATION] Client update result:`, clientUpdateResult);
                  console.log(`[CAR RESERVATION] Car owner field set to:`, carToUpdate.owner);
                }
              }

              // Create or update delivery record and attach client
              const deliveryResult = await Delivery.findOneAndUpdate(
                { car: id, salesperson: user._id },
                { $setOnInsert: { car: id, salesperson: user._id }, ...(linkedClientId ? { client: linkedClientId } : {}) },
                { new: true, upsert: true }
              );
              if (linkedClientId && deliveryResult && (!deliveryResult.client || String(deliveryResult.client) !== String(linkedClientId))) {
                deliveryResult.client = linkedClientId;
                await deliveryResult.save();
              }
            } else {
              // no-op if user not found
            }
          } catch (deliveryError) {
            console.error('Failed to create delivery record:', deliveryError);
            // Don't fail the status update if delivery creation fails
          }
        }

        // If moving away from 'reserved', remove any delivery records for this car
        if (oldStatus === 'reserved' && status !== 'reserved') {
          try {
            await Delivery.deleteMany({ car: id });
          } catch (cleanupErr) {
            console.error('Failed to remove deliveries after status change:', cleanupErr);
            // Do not block the status update
          }
          // Also unlink the vehicle from any client association
          try {
            if (carToUpdate.owner) {
              const ownerId = carToUpdate.owner;
              await Client.updateOne(
                { _id: ownerId },
                { $pull: { cars: id } }
              );
            }
            carToUpdate.owner = undefined;
          } catch (unlinkErr) {
            console.error('Failed to unlink car from client after leaving reserved:', unlinkErr);
          }
        }
      }

      carToUpdate.status = status;
      console.log(`[CAR RESERVATION] Saving car with status=${status}, owner=${carToUpdate.owner}`);
      const updatedCar = await carToUpdate.save();
      console.log(`[CAR RESERVATION] Car saved successfully. Owner in DB:`, updatedCar.owner);

      await updatedCar.populate('images');

      return NextResponse.json({ success: true, data: updatedCar.toObject({ virtuals: true }) });

    } else if (contentType.includes('multipart/form-data')) {
      // Handle formData for full update
      const data = await request.formData();
      const updateData = {};
      const newImageIds = [];

      // Handle new image uploads (generate medium + thumbnail WebP variants)
      const imageFiles = data.getAll('images');
      const imageTitles = data.getAll('imageTitles');
      for (const [index, file] of imageFiles.entries()) {
        if (typeof file === 'object' && file.name) {
          const arrayBuf = await file.arrayBuffer();
          const input = Buffer.from(arrayBuf);
          const sharp = (await import('sharp')).default;
          const medium = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          const thumb = await sharp(input).rotate().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

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

      // Handle existing images to keep (ensure valid ObjectId strings)
      const existingImageIdsRaw = data.getAll('existingImages').map(v => String(v));
      const existingImageIds = existingImageIdsRaw.filter(id => mongoose.Types.ObjectId.isValid(id));

      // Handle other form fields
      for (const [key, value] of data.entries()) {
        if (key !== 'images' && key !== 'existingImages' && key !== 'imageTitles' && key !== 'imageOrder' && key !== 'coverImageIndex' && key !== 'vinImageIndex') {
          if (['year', 'price', 'kilometers'].includes(key)) {
            const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
            if (!Number.isNaN(num)) updateData[key] = num;
          } else if (['demo', 'doNotAdvertise'].includes(key)) {
            updateData[key] = value === 'true' || value === true;
          } else {
            updateData[key] = value;
          }
        }
      }

      // Handle image role indices separately
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

      // Combine image lists respecting client-provided order if available
      const orderMarkers = data.getAll('imageOrder');
      if (orderMarkers && orderMarkers.length > 0) {
        const finalOrdered = [];
        for (const marker of orderMarkers) {
          const m = String(marker);
          if (m.startsWith('new:')) {
            const idxStr = m.split(':')[1];
            const idx = parseInt(idxStr, 10);
            if (!Number.isNaN(idx) && newImageIds[idx]) {
              finalOrdered.push(newImageIds[idx]);
            }
          } else {
            // Existing image id
            if (existingImageIds.includes(m) && mongoose.Types.ObjectId.isValid(m)) {
              finalOrdered.push(m);
            }
          }
        }
        // Ensure no images are lost: append any not referenced in orderMarkers
        const remaining = [...existingImageIds, ...newImageIds].filter(id => !finalOrdered.includes(id));
        updateData.images = [...finalOrdered, ...remaining].filter(id => mongoose.Types.ObjectId.isValid(id));
      } else {
        // Fallback: keep existing first then new
        updateData.images = [...existingImageIds, ...newImageIds].filter(id => mongoose.Types.ObjectId.isValid(id));
      }

            const carToUpdate = await Car.findById(id);
      if (!carToUpdate) {
        return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
      }

      const oldData = carToUpdate.toObject();
      const changes = [];

            // Compare fields and log changes
      for (const key in updateData) {
        if (key === 'images') continue;

        const oldValue = oldData[key];
        const newValue = updateData[key];

        // Treat null, undefined, and '' as equivalent for empty fields to avoid phantom logs.
        const oldIsEmpty = oldValue === null || oldValue === undefined || oldValue === '';
        const newIsEmpty = newValue === null || newValue === undefined || newValue === '';

        if (oldIsEmpty && newIsEmpty) {
          continue; // Both are empty, so no change.
        }

        // If values are genuinely different, log the change.
        if (String(oldValue) !== String(newValue)) {
          changes.push(`'${key}' from '${oldValue || 'N/A'}' to '${newValue}'`);
        }
      }

      // Special handling for images to see if they changed (including reordering)
      const oldImageIds = Array.isArray(oldData.images) ? oldData.images.map(img => img.toString()) : [];
      const newImageIdsCombined = Array.isArray(updateData.images) ? updateData.images.map(id => id.toString()) : [...existingImageIds, ...newImageIds];
      if (JSON.stringify(oldImageIds) !== JSON.stringify(newImageIdsCombined)) {
        changes.push('images were updated');
      }

      if (changes.length > 0) {
        const auditEntry = {
          action: 'Car Details Update',
          details: `Updated fields: ${changes.join(', ')}`,
          user: userName || userPhone || 'unknown',
        };
        carToUpdate.auditLog.push(auditEntry);
      }

      // Apply updates
      Object.assign(carToUpdate, updateData);

      const updatedCar = await carToUpdate.save();
      await updatedCar.populate('images');

      if (!updatedCar) {
        return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
      }

      const carObject = updatedCar.toObject({ virtuals: true });
      return NextResponse.json({ success: true, data: carObject });
    } else {
      return NextResponse.json({ success: false, message: 'Unsupported Content-Type' }, { status: 415 });
    }
  } catch (error) {
    console.error('Error in PUT /api/cars/[id]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE handler
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    // Ensure session and admin privilege
    const session = await requireSession(request);
    if (!isPrivileged({ ...session, role: session.role })) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    await request.blob();
    const { id } = params;

    // Load car with images and owner info first
    const car = await Car.findById(id).populate('images');
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }

    // Collect picture ids and keys to delete from R2
    const pictures = Array.isArray(car.images) ? car.images : [];
    const pictureIds = pictures.map((p) => p._id).filter(Boolean);

    // Compute object keys from URLs by stripping the public base
    const keys = [];
    const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    for (const pic of pictures) {
      const img = (pic && pic.imageUrl) ? String(pic.imageUrl) : '';
      const thumb = (pic && pic.thumbnailUrl) ? String(pic.thumbnailUrl) : '';
      for (const url of [img, thumb]) {
        if (!url) continue;
        if (publicBase && url.startsWith(publicBase + '/')) {
          keys.push(url.substring(publicBase.length + 1));
        } else {
          // Fallback: attempt to extract known prefix 'pictures/' if present
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

    // Remove deliveries associated with this car
    try {
      await Delivery.deleteMany({ car: id });
    } catch (e) {
      console.error('Failed to delete Delivery records for car', id, e);
    }

    // Unlink from client if linked
    try {
      if (car.owner) {
        await Client.updateOne({ _id: car.owner }, { $pull: { cars: id } });
      }
    } catch (e) {
      console.error('Failed to unlink car from client', id, e);
    }

    // Pull the car id from WhatsAppGeneration records (do not fail deletion if this errors)
    try {
      await WhatsAppGeneration.updateMany(
        { carIds: { $in: [String(id)] } },
        { $pull: { carIds: String(id) } }
      );
    } catch (e) {
      console.error('Failed to update WhatsAppGeneration records for car', id, e);
    }

    // Finally delete the car
    await Car.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error('Error in DELETE /api/cars/[id]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
