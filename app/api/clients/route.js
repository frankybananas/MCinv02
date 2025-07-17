import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Phone from '@/models/Phone'; 
import Car from '@/models/Car'; // Ensure Car model is registered
import Document from '@/models/Document'; // Ensure Document model is registered

// The middleware now handles all authentication. 
// These routes will only be reached if the user has a valid session token.

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

    Object.keys(body).forEach(key => {
      if (body[key] === '') delete body[key];
    });
    
    if (body.phone) {
      let phoneNumber = body.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      body.phone = phoneNumber;
    }

    const client = await Client.create(body);
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Clients API POST Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create client.', error: error.message }, { status: 500 });
  }
}
