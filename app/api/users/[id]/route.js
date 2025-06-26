import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

// Get a single user by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    // Don't return sensitive information
    const userObj = user.toObject();
    delete userObj.otpSecret;
    
    return NextResponse.json({ success: true, data: userObj });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update a user by ID
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    const body = await request.json();
    
    // Don't allow updating sensitive fields through this endpoint
    delete body.otpSecret;
    delete body.otpExpiry;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    // Don't return sensitive information
    const userObj = user.toObject();
    delete userObj.otpSecret;
    
    return NextResponse.json({ success: true, data: userObj });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Delete a user by ID
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
