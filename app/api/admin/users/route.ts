import { NextResponse } from 'next/server';
import { connect as dbConnect } from '@/lib/mongodb';
import User from '@/models/User';
import { headers } from 'next/headers';
import parsePhoneNumber from 'libphonenumber-js';

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
    const { phone: rawPhone, firstName, lastName, department, role } = body;

    if (!rawPhone || !firstName || !lastName || !department || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Normalize phone number to E.164 format
    const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
    if (!phoneNumber || !phoneNumber.isValid()) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }
    const phone = phoneNumber.format('E.164');

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

export async function PATCH(request: Request) {
  const requestHeaders = request.headers;
  const userRole = requestHeaders.get('x-user-role');
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
  }

  try {
    await dbConnect();
    const body = await request.json();
    const { userId, matchingEnabled, todoEnabled, marketingEnabled, role, department, firstName, lastName, phone: rawPhone } = body || {};
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const set: Record<string, any> = {};
    if (typeof matchingEnabled === 'boolean') set.matchingEnabled = matchingEnabled;
    if (typeof todoEnabled === 'boolean') set.todoEnabled = todoEnabled;
    if (typeof marketingEnabled === 'boolean') set.marketingEnabled = marketingEnabled;
    if (role && ['admin', 'user', 'manager'].includes(role)) set.role = role;
    if (department && ['new', 'used'].includes(department)) set.department = department;
    if (rawPhone) {
      // Normalize phone number to E.164 format
      const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
      if (!phoneNumber || !phoneNumber.isValid()) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
      set.phone = phoneNumber.format('E.164');
    }
    if (firstName || lastName) {
      if (firstName) set['profile.firstName'] = firstName;
      if (lastName) set['profile.lastName'] = lastName;
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(userId, { $set: set }, { new: true });
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const requestHeaders = request.headers;
  const userRole = requestHeaders.get('x-user-role');
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
  }

  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
