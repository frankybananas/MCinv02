import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car';
import { NextResponse } from 'next/server';

// Get a single car by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const id = params.id;
    
    const car = await Car.findById(id).populate('owner').populate('images');
    
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }

    // Manually transform the data to include a string ID
    const carObject = car.toObject();
    carObject.id = carObject._id.toString();
    delete carObject._id;
    delete carObject.__v;
    
    return NextResponse.json({ success: true, data: carObject });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update a car by ID
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    const id = params.id;
    const body = await request.json();
    
    const car = await Car.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }

    // Manually transform the data to include a string ID
    const carObject = car.toObject();
    carObject.id = carObject._id.toString();
    delete carObject._id;
    delete carObject.__v;
    
    return NextResponse.json({ success: true, data: carObject });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Delete a car by ID
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    const id = params.id;
    
    const car = await Car.findByIdAndDelete(id);
    
    if (!car) {
      return NextResponse.json({ success: false, message: 'Car not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
