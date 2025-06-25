import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

// Get all users
export async function GET() {
  try {
    await connectToDatabase();
    const users = await User.find({}).sort({ createdAt: -1 });
    
    // Don't return sensitive information like OTP secrets
    const safeUsers = users.map(user => {
      const userObj = user.toObject();
      delete userObj.otpSecret;
      return userObj;
    });
    
    return NextResponse.json({ success: true, data: safeUsers });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Create a new user (for admin to manually add authorized users)
export async function POST(request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    
    // Set isAuthorized to true since these are manually added by admin
    const userData = {
      ...body,
      isAuthorized: true
    };
    
    const user = await User.create(userData);
    
    // Don't return sensitive information
    const userObj = user.toObject();
    delete userObj.otpSecret;
    
    return NextResponse.json({ success: true, data: userObj }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
