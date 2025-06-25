import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Starting simple cars API request');
    
    // Connect to database
    await connectToDatabase();
    console.log('Connected to database');
    
    // Simple query without population
    const cars = await Car.find({});
    console.log(`Found ${cars.length} cars`);
    
    return NextResponse.json({ 
      success: true, 
      count: cars.length,
      data: cars 
    });
  } catch (error) {
    console.error('Cars Simple API Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
