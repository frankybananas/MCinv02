import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Session from '@/models/Session'; // Import Session model
import Phone from '@/models/Phone'; 
import Car from '@/models/Car'; // Ensure Car model is registered
import Document from '@/models/Document'; // Ensure Document model is registered

async function verifyAuth(request) {
  console.log('--- Verifying Auth (Clients) ---');
  try {
    await connectToDatabase();
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    console.log('Token from cookie:', token ? 'Found' : 'Not Found');

    if (!token) {
      console.log('Auth failed: No token provided.');
      return { authorized: false, error: 'Unauthorized', status: 401 };
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }

    const decoded = jwt.verify(token, jwtSecret);
    console.log('Decoded JWT:', decoded);

    if (!decoded || !decoded.jti) {
        console.log('Auth failed: Invalid token payload, jti missing.');
        return { authorized: false, error: 'Invalid token payload', status: 401 };
    }

    console.log(`Querying for active session with jti: ${decoded.jti}`);
    const session = await Session.findOne({ jwtId: decoded.jti, isActive: true });

    if (!session) {
        console.log('Auth failed: Session not found in DB or is inactive.');
        return { authorized: false, error: 'Session not found or inactive', status: 401 };
    }

    // Optionally, update lastAccessedAt
    session.lastAccessedAt = new Date();
    await session.save();

    console.log('Auth successful.');
    return { authorized: true, phone: decoded.phone };
  } catch (error) {
    console.error('--- Auth Error (Clients) ---');
    if (error.name === 'JsonWebTokenError') {
      console.error('JWT Error:', error.message);
    } else if (error.name === 'TokenExpiredError') {
      console.error('JWT Expired:', error.message);
    } else {
      console.error('An unexpected error occurred during auth:', error);
    }
    return { authorized: false, error: 'Unauthorized: Invalid token', status: 401 };
  }
}

export async function GET() {
  const auth = await verifyAuth();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  try {
    const clients = await Client.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAuth();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  try {
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
