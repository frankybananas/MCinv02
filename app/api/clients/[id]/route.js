import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import { NextResponse } from 'next/server';

// Get a single client by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    
    const client = await Client.findById(id).populate('cars').populate('documents');
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update a client by ID
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    const body = await request.json();

    // Format phone number if provided
    if (body.phone) {
      let phoneNumber = body.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      body.phone = phoneNumber;
    }
    
    const client = await Client.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Delete a client by ID
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    
    const client = await Client.findByIdAndDelete(id);
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
