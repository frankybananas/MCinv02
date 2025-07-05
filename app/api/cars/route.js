import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import Client from '@/models/Client';
import Picture from '@/models/Picture';
import Session from '@/models/Session';
import { NextResponse } from 'next/server';
import { s3 } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

async function verifyAuth(request) {
  console.log('--- Verifying Auth ---');
  try {
    await connectToDatabase();
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    console.log('Token from cookie:', token ? 'Found' : 'Not Found');

    if (!token) {
      console.log('Auth failed: No token provided.');
      return { authorized: false, error: 'Unauthorized', status: 401 };
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }

    const decoded = jwt.verify(token, jwtSecret);
    console.log('Decoded JWT:', decoded);

    if (!decoded || !decoded.jti) {
        console.log('Auth failed: Invalid token payload, jti missing.');
        return { authorized: false, error: 'Invalid token payload', status: 401 };
    }

    console.log(`Querying for active session with jti: ${decoded.jti}`);
    const session = await Session.findOne({ jwtId: decoded.jti, isActive: true });

    if (!session) {
        console.log('Auth failed: Session not found in DB or is inactive.');
        return { authorized: false, error: 'Session not found or inactive', status: 401 };
    }

    // Optionally, update lastAccessedAt
    session.lastAccessedAt = new Date();
    await session.save();

    console.log('Auth successful.');
    return { authorized: true, phone: decoded.phone };
  } catch (error) {
    console.error('--- Auth Error ---');
    if (error.name === 'JsonWebTokenError') {
      console.error('JWT Error:', error.message);
    } else if (error.name === 'TokenExpiredError') {
      console.error('JWT Expired:', error.message);
    } else {
      console.error('An unexpected error occurred during auth:', error);
    }
    return { authorized: false, error: 'Unauthorized: Invalid token', status: 401 };
  }
}

export async function GET() {
  const auth = await verifyAuth();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  try {
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
  const auth = await verifyAuth();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  try {
    const data = await request.formData();
    const carData = {};
    const files = data.getAll('images');

    for (const [key, value] of data.entries()) {
      if (key !== 'images') carData[key] = value;
    }

    const newCar = await Car.create(carData);

    if (files && files.length > 0) {
      const newPictureIds = await Promise.all(files.filter(f => f.size > 0).map(async file => {
        const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
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
