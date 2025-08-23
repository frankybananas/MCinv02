import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Phone from '@/models/Phone'; 
import Car from '@/models/Car'; // Ensure Car model is registered
import Document from '@/models/Document'; // Ensure Document model is registered
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// The middleware now handles all authentication. 
// These routes will only be reached if the user has a valid session token.

export async function GET() {
  try {
    await connectToDatabase();
    // Verify user and apply role-based filtering
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
    const query = isPrivileged ? {} : { createdByPhone: phone };
    const clients = await Client.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();

    // Verify user creating the client
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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

    // Set owner of client to the creator's phone
    body.createdByPhone = phone;

    const client = await Client.create(body);
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Clients API POST Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create client.', error: error.message }, { status: 500 });
  }
}

