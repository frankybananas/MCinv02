import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car.js';
import Client from '@/models/Client';
import Picture from '@/models/Picture';
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// The middleware now handles all authentication.

export async function GET() {
  try {
    await connectToDatabase();
    const cars = await Car.find({}).sort({ createdAt: -1 }).populate('owner').populate('images');
    const formattedCars = cars.map(car => ({
      ...car.toObject(),
      id: car._id.toString(),
    }));
    return NextResponse.json({ success: true, data: formattedCars });
  } catch (error) {
    console.error('Cars API GET Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch cars.', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const data = await request.formData();
    const carData = {};
    const files = data.getAll('images');

    for (const [key, value] of data.entries()) {
      if (key === 'images') continue;
      if (['year', 'price', 'kilometers'].includes(key)) {
        const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
        if (!Number.isNaN(num)) carData[key] = num;
      } else {
        carData[key] = value;
      }
    }

    const newCar = await Car.create(carData);

    if (files && files.length > 0) {
      const newPictureIds = await Promise.all(files.filter(f => f.size > 0).map(async file => {
        const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
        const { s3 } = await import('@/lib/s3');
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: newFileName,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }));
        const imageUrl = `${process.env.R2_PUBLIC_URL}/${newFileName}`;
        const newPicture = new Picture({ title: `${newCar.make} ${newCar.model}`, imageUrl, car: newCar._id });
        await newPicture.save();
        return newPicture._id;
      }));
      newCar.images.push(...newPictureIds);
      await newCar.save();
    }

    const populatedCar = await Car.findById(newCar._id).populate('owner').populate('images');
    return NextResponse.json({ success: true, data: populatedCar.toObject({ virtuals: true }) }, { status: 201 });
  } catch (error) {
    console.error('Cars API POST Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
