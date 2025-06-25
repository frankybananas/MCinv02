import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Phone from '@/models/Phone';
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
    const body = await request.json();
    await connectToDatabase();
    
    // Create the client
    const client = await Client.create(body);
    
    // If phone numbers are provided, create them and associate with the client
    if (body.phoneNumbers && Array.isArray(body.phoneNumbers)) {
      for (const phoneData of body.phoneNumbers) {
        await Phone.create({
          ...phoneData,
          client: client._id
        });
      }
    }
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
