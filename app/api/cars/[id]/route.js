import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import Car from '@/models/Car.js';
import Picture from '@/models/Picture';
import Session from '@/models/Session'; // Import Session model
import Delivery from '@/models/Delivery.ts';
import User from '@/models/User.ts';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

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

  const { id } = await params;

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Handle JSON for status update
      const { status } = await request.json();

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

        // Auto-create delivery when status changes to 'reserved'
        if (status === 'reserved' && userPhone) {
          try {
            // Find user by phone to get userId
            const user = await User.findOne({ phone: userPhone });
            
            if (user) {
              // Create or update delivery record
              const deliveryResult = await Delivery.findOneAndUpdate(
                { car: id, salesperson: user._id },
                { $setOnInsert: { car: id, salesperson: user._id } },
                { new: true, upsert: true }
              );
            } else {
              // no-op if user not found
            }
          } catch (deliveryError) {
            console.error('Failed to create delivery record:', deliveryError);
            // Don't fail the status update if delivery creation fails
          }
        }
      }

      carToUpdate.status = status;
      const updatedCar = await carToUpdate.save();

      await updatedCar.populate('images');

      return NextResponse.json({ success: true, data: updatedCar.toObject({ virtuals: true }) });

    } else if (contentType.includes('multipart/form-data')) {
      // Handle formData for full update
      const data = await request.formData();
      const updateData = {};
      const newImageIds = [];

      // Handle new image uploads
      const imageFiles = data.getAll('images');
      const imageTitles = data.getAll('imageTitles');
      for (const [index, file] of imageFiles.entries()) {
        if (typeof file === 'object' && file.name) {
          // Lazy-load the S3 client to avoid requiring credentials when no image uploads
          const { s3 } = await import('@/lib/s3');
          const buffer = Buffer.from(await file.arrayBuffer());
          const fileName = `${uuidv4()}-${file.name}`;

          await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
          }));

          const imageUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
          const newPicture = new Picture({
            imageUrl,
            fileName,
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
        if (key !== 'images' && key !== 'existingImages' && key !== 'imageTitles') {
          if (['year', 'price', 'kilometers'].includes(key)) {
            const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
            if (!Number.isNaN(num)) updateData[key] = num;
          } else {
            updateData[key] = value;
          }
        }
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
    await request.blob();
    const { id } = params;
    const car = await Car.findByIdAndDelete(id);
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
