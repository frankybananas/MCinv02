import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

// Request OTP for phone authentication
export async function POST(request) {
  try {
    const { phone } = await request.json();
    
    if (!phone) {
      return NextResponse.json({ 
        success: false, 
        message: 'Phone number is required' 
      }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Check if the user is authorized
    const user = await User.findOne({ phone });
    
    if (!user || !user.isAuthorized) {
      return NextResponse.json({ 
        success: false, 
        message: 'Phone number not authorized' 
      }, { status: 403 });
    }
    
    // For test phone numbers, we'll use a fixed OTP code
    if (user.isTestAccount || phone === '+1 650-555-3434') {
      // Set a mock OTP for test accounts
      const mockOtp = '123456';
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes
      
      // In a real scenario, we would hash this before storing
      user.otpSecret = mockOtp;
      user.otpExpiry = otpExpiry;
      await user.save();
      
      return NextResponse.json({ 
        success: true, 
        message: 'OTP sent successfully (mock for test account)',
        testOtp: mockOtp // Only for test accounts
      });
    }
    
    // For real phone numbers, we would integrate with Twilio here
    // This is a placeholder for future Twilio integration
    
    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes
    
    // In a real scenario, we would hash this before storing
    user.otpSecret = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    // TODO: Integrate with Twilio to send the OTP
    
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully' 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
