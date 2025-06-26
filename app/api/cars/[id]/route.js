import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import { NextResponse } from 'next/server';

// Get a single car by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    
    const car = await Car.findById(id).populate('owner').populate('images');
    
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: car });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update a car by ID
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    const body = await request.json();
    
    const car = await Car.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: car });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Delete a car by ID
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
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
