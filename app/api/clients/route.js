import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Phone from '@/models/Phone'; 
import Car from '@/models/Car'; // Ensure Car model is registered
import Document from '@/models/Document'; // Ensure Document model is registered
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    const clients = await Client.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();

    // Sanitize body: remove empty string fields so Mongoose doesn't fail validation
    // on optional fields.
    Object.keys(body).forEach(key => {
      if (body[key] === '') {
        delete body[key];
      }
    });
    
    // Format phone number if provided
    if (body.phone) {
      let phoneNumber = body.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      body.phone = phoneNumber;
    }

    // Create the client
    const client = await Client.create(body);
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Clients API POST Error:', error);
    
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create client.',
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined 
    }, { status: 500 });
  }
}
