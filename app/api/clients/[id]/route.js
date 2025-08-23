import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Get a single client by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = params;
    // Verify user
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    let role = 'user';
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      role = (payload.role ?? 'user');
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const client = await Client.findById(id).populate('cars').populate('documents');
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    const isPrivileged = role === 'admin' || role === 'manager';
    if (!isPrivileged && client.createdByPhone && client.createdByPhone !== phone) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
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
    // Verify user
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    let role = 'user';
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      role = (payload.role ?? 'user');
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Format phone number if provided
    if (body.phone) {
      let phoneNumber = body.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      body.phone = phoneNumber;
    }
    // Enforce ownership for non-privileged users
    const isPrivileged = role === 'admin' || role === 'manager';
    const filter = isPrivileged ? { _id: id } : { _id: id, createdByPhone: phone };

    const client = await Client.findOneAndUpdate(
      filter,
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
    // Verify user
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    let role = 'user';
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      role = (payload.role ?? 'user');
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const isPrivileged = role === 'admin' || role === 'manager';
    const filter = isPrivileged ? { _id: id } : { _id: id, createdByPhone: phone };

    const client = await Client.findOneAndDelete(filter);
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
