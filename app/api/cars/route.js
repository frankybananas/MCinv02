import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import Client from '@/models/Client';
import Picture from '@/models/Picture';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    console.log('Fetching cars with owner and images populated...');

    // By importing Client and Picture, we ensure they are registered with Mongoose
    // before the `populate` call is made. This is a common pattern to avoid
    // "Schema hasn't been registered for model" errors in serverless environments.
    const cars = await Car.find({})
      .sort({ createdAt: -1 })
      .populate('owner')
      .populate('images');
      
    console.log(`Successfully fetched ${cars.length} cars.`);

    // Manually transform the data to include a string ID
    const formattedCars = cars.map(car => {
      const carObject = car.toObject();
      carObject.id = carObject._id.toString();
      delete carObject._id;
      delete carObject.__v;
      return carObject;
    });
    
    return NextResponse.json({ success: true, data: formattedCars });
  } catch (error) {
    console.error('Cars API GET Error:', error);
    
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch cars.',
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined 
    }, { status: 500 });
  }
}

import { s3 } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    await connectToDatabase();
    const data = await request.formData();

    const carData = {};
    const files = data.getAll('images');

    for (const [key, value] of data.entries()) {
      if (key !== 'images') {
        carData[key] = value;
      }
    }

    // Create the car first without the images
    const newCar = await Car.create(carData);

    if (files && files.length > 0) {
      const newPictureIds = [];
      for (const file of files) {
        if (file.size === 0) continue;

        const fileExtension = file.name.split('.').pop();
        const newFileName = `${uuidv4()}.${fileExtension}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: newFileName,
            Body: Buffer.from(await file.arrayBuffer()),
            ContentType: file.type,
          })
        );

        const imageUrl = `${process.env.R2_PUBLIC_URL}/${newFileName}`;

        const newPicture = new Picture({
          title: newCar.make + ' ' + newCar.model,
          imageUrl: imageUrl,
          car: newCar._id,
        });
        await newPicture.save();
        newPictureIds.push(newPicture._id);
      }

      // Add all new pictures to the car's images array
      newCar.images.push(...newPictureIds);
      await newCar.save();
    }

    // Repopulate to return the full object
    const populatedCar = await Car.findById(newCar._id).populate('owner').populate('images');

    const carObject = populatedCar.toObject({ virtuals: true });
    
    return NextResponse.json({ success: true, data: carObject }, { status: 201 });
  } catch (error) {
    console.error('Cars API POST Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
