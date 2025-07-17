import { NextResponse } from 'next/server';
import { connect as dbConnect } from '@/lib/mongodb';
import User from '@/models/User';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const requestHeaders = request.headers;
  const userRole = requestHeaders.get('x-user-role');

  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
  }

  try {
    await dbConnect();
    const users = await User.find({}).sort({ createdAt: -1 }); // Fetch all users, sorted by creation date
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // --- DIAGNOSTIC LOG --- 
  console.log('Logging headers function from next/headers:', headers);
  const requestHeaders = request.headers;
  console.log('Logging request headers object:', requestHeaders);
  const userRole = requestHeaders.get('x-user-role');
  // const userRole = headers().get('x-user-role'); // Temporarily disabled for debugging

  // Double-check for admin role, even though middleware should protect this route
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
  }

  try {
    await dbConnect();

    const body = await request.json();
    const { phone, firstName, lastName, department, role } = body;

    if (!phone || !firstName || !lastName || !department || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
    }

    // Create new user
    const newUser = new User({
      phone,
      profile: { firstName, lastName },
      department,
      role,
      isAuthorized: true, // Authorize new users by default
    });

    await newUser.save();

    return NextResponse.json({ message: 'User created successfully', user: newUser }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
