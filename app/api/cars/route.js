import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    console.log('Connected to database, fetching cars...');
    
    // First try without population to see if basic query works
    const cars = await Car.find({}).sort({ createdAt: -1 });
    console.log(`Found ${cars.length} cars without population`);
    
    // Then try to populate if needed, with error handling
    let populatedCars = cars;
    try {
      // Try to populate owner first
      try {
        populatedCars = await Car.find({}).sort({ createdAt: -1 }).populate('owner');
        console.log('Owner population successful');
      } catch (ownerError) {
        console.error('Error populating car owners:', ownerError);
      }
      
      // Then try to populate images
      try {
        populatedCars = await Car.find({}).sort({ createdAt: -1 })
          .populate('owner')
          .populate('images');
        console.log('Images population successful');
      } catch (imagesError) {
        console.error('Error populating car images:', imagesError);
      }
    } catch (populateError) {
      console.error('Error in population process:', populateError);
      // Continue with unpopulated cars
    }
    
    return NextResponse.json({ success: true, data: populatedCars });
  } catch (error) {
    console.error('Cars API Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    
    const car = await Car.create(body);
    
    return NextResponse.json({ success: true, data: car }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
