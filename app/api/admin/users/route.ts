import { NextResponse } from 'next/server';
import { connect as dbConnect } from '@/lib/mongodb';
import User from '@/models/User';
import parsePhoneNumber from 'libphonenumber-js';
import { requireSession, verifyActiveSession } from '@/lib/auth-session';

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
    }
    await dbConnect();
    const users = await User.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
    }
    await dbConnect();

    const body = await request.json();
    const { phone: rawPhone, firstName, lastName, department, role } = body;

    if (!rawPhone || !firstName || !lastName || !department || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
    if (!phoneNumber || !phoneNumber.isValid()) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }
    const phone = phoneNumber.format('E.164');

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
    }

    const newUser = new User({
      phone,
      profile: { firstName, lastName },
      department,
      role,
      isAuthorized: true,
    });

    await newUser.save();
    return NextResponse.json({ message: 'User created successfully', user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
    }
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
    if (role && ['admin', 'user', 'manager', 'recon'].includes(role)) set.role = role;
    if (department && ['new', 'used'].includes(department)) set.department = department;
    if (rawPhone) {
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
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: User is not an admin.' }, { status: 403 });
    }
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
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
