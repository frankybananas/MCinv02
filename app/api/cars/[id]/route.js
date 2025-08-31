import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import Car from '@/models/Car.js';
import Picture from '@/models/Picture';
import Session from '@/models/Session'; // Import Session model
import { v4 as uuidv4 } from 'uuid';

// GET handler
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const car = await Car.findById(params.id).populate('owner').populate('images');
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
export async function PUT(request, context) {
  const headersList = headers();
  const userPhone = headersList.get('x-user-phone');

    const { id } = await context.params;

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

      console.log(`[AUDIT_DEBUG] Received status update for car ${id}. New status: ${status}, Old status: ${oldStatus}`);
      console.log(`[AUDIT_DEBUG] User phone from header: ${userPhone}`);

      // Only add a log entry if the status actually changed.
      if (oldStatus !== status) {
        const auditEntry = {
          action: 'Car Status Update',
          details: `Status changed from '${oldStatus}' to '${status}'`,
          user: userPhone, // Retrieved from header
        };
        console.log('[AUDIT_DEBUG] Status changed. Creating audit entry:', auditEntry);
        carToUpdate.auditLog.push(auditEntry);
      }

      carToUpdate.status = status;
      const updatedCar = await carToUpdate.save();
      console.log('[AUDIT_DEBUG] Car saved successfully. Current auditLog count:', updatedCar.auditLog.length);

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

      // Handle existing images to keep
      const existingImageIds = data.getAll('existingImages');

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

      // Combine image lists and update the car
      updateData.images = [...existingImageIds, ...newImageIds];

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

      // Special handling for images to see if they changed
      const oldImageIds = oldData.images.map(img => img.toString());
      const newImageIdsCombined = [...existingImageIds, ...newImageIds];
      if (JSON.stringify(oldImageIds.sort()) !== JSON.stringify(newImageIdsCombined.sort())) {
        changes.push('images were updated');
      }

      if (changes.length > 0) {
        const auditEntry = {
          action: 'Car Details Update',
          details: `Updated fields: ${changes.join(', ')}`,
          user: userPhone,
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
    const car = await Car.findByIdAndDelete(params.id);
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
