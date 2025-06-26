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
    
    return NextResponse.json({ success: true, data: cars });
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

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    
    const car = await Car.create(body);
    
    return NextResponse.json({ success: true, data: car }, { status: 201 });
  } catch (error) {
    console.error('Cars API POST Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
