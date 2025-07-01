import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { s3 } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import Car from '@/models/Car';
import Picture from '@/models/Picture';
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

// PUT handler with corrected file upload logic
export async function PUT(request, { params }) {
  const { id } = params;
  try {
    await connectToDatabase();
    const data = await request.formData();
    const updateData = {};
    const newImageIds = [];

    // Handle new image uploads
    const imageFiles = data.getAll('images');
    const imageTitles = data.getAll('imageTitles');
    for (const [index, file] of imageFiles.entries()) {
      if (typeof file === 'object' && file.name) {
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
          title: imageTitles[index] || file.name, // Use provided title or fallback to filename
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
        updateData[key] = value;
      }
    }

    // Combine image lists and update the car
    updateData.images = [...existingImageIds, ...newImageIds];

    const updatedCar = await Car.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('images');

    if (!updatedCar) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }

    const carObject = updatedCar.toObject({ virtuals: true });
    return NextResponse.json({ success: true, data: carObject });

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
