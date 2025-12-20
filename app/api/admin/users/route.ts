import { NextResponse } from 'next/server';
import { connect as dbConnect } from '@/lib/mongodb';
import User from '@/models/User';
import parsePhoneNumber from 'libphonenumber-js';
import { requireSession, verifyActiveSession } from '@/lib/auth-session';
import { getClientIp } from '@/lib/audit-logger';
import { logAuditEvent } from '@/lib/audit-log';

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
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = getClientIp(request);
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

    logAuditEvent({
      eventType: 'USER_CREATED',
      phone: session.phone,
      userId: session.userId || undefined,
      ip,
      userAgent,
      metadata: {
        targetUserId: String(newUser._id),
        targetPhone: newUser.phone,
        role: newUser.role,
        department: newUser.department,
      },
    });
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
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = getClientIp(request);
    await dbConnect();
    const body = await request.json();
    const { userId, matchingEnabled, todoEnabled, marketingEnabled, role, department, firstName, lastName, phone: rawPhone } = body || {};
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const existingUser = await User.findById(userId);

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

    if (existingUser) {
      if (typeof set.role === 'string' && existingUser.role !== set.role) {
        logAuditEvent({
          eventType: 'ROLE_CHANGE',
          phone: session.phone,
          userId: session.userId || undefined,
          ip,
          userAgent,
          metadata: {
            targetUserId: userId,
            targetPhone: updated.phone,
            oldRole: existingUser.role,
            newRole: set.role,
          },
        });
      }

      const permissionChanges: Record<string, { old: unknown; new: unknown }> = {};
      if (typeof set.matchingEnabled === 'boolean' && existingUser.matchingEnabled !== set.matchingEnabled) {
        permissionChanges.matchingEnabled = { old: existingUser.matchingEnabled, new: set.matchingEnabled };
      }
      if (typeof set.todoEnabled === 'boolean' && existingUser.todoEnabled !== set.todoEnabled) {
        permissionChanges.todoEnabled = { old: existingUser.todoEnabled, new: set.todoEnabled };
      }
      if (typeof set.marketingEnabled === 'boolean' && existingUser.marketingEnabled !== set.marketingEnabled) {
        permissionChanges.marketingEnabled = { old: existingUser.marketingEnabled, new: set.marketingEnabled };
      }

      if (Object.keys(permissionChanges).length > 0) {
        logAuditEvent({
          eventType: 'PERMISSIONS_CHANGE',
          phone: session.phone,
          userId: session.userId || undefined,
          ip,
          userAgent,
          metadata: {
            targetUserId: userId,
            targetPhone: updated.phone,
            changes: permissionChanges,
          },
        });
      }
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
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = getClientIp(request);
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

    logAuditEvent({
      eventType: 'USER_DELETED',
      phone: session.phone,
      userId: session.userId || undefined,
      ip,
      userAgent,
      metadata: {
        targetUserId: userId,
        targetPhone: deleted.phone,
        role: deleted.role,
        department: deleted.department,
      },
    });
    
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
