import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

// Verify OTP for phone authentication
export async function POST(request) {
  try {
    const { phone, otp } = await request.json();
    
    if (!phone || !otp) {
      return NextResponse.json({ 
        success: false, 
        message: 'Phone number and OTP are required' 
      }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Find the user with the provided phone number
    const user = await User.findOne({ phone });
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 });
    }
    
    // Check if the user is authorized
    if (!user.isAuthorized) {
      return NextResponse.json({ 
        success: false, 
        message: 'Phone number not authorized' 
      }, { status: 403 });
    }
    
    // Check if OTP is valid
    if (!user.otpSecret || user.otpSecret !== otp) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid OTP' 
      }, { status: 400 });
    }
    
    // Check if OTP is expired
    if (user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
      return NextResponse.json({ 
        success: false, 
        message: 'OTP expired' 
      }, { status: 400 });
    }
    
    // OTP is valid, update user's last login time
    user.lastLogin = new Date();
    
    // Clear OTP data after successful verification
    user.otpSecret = undefined;
    user.otpExpiry = undefined;
    
    await user.save();
    
    // Return user data (excluding sensitive information)
    const userObj = user.toObject();
    delete userObj.otpSecret;
    delete userObj.otpExpiry;
    
    return NextResponse.json({ 
      success: true, 
      message: 'OTP verified successfully',
      user: userObj
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
