import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Delivery from '@/models/Delivery';
import User from '@/models/User';
import { NextResponse } from 'next/server';
import { requireSession, isPrivileged as checkPrivileged, verifyActiveSession } from '@/lib/auth-session';

// Get a single client by ID
export async function GET(request, { params }) {
  try {
    const session = await requireSession(request);
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    // Use clone() because we also need to read the JSON body later.
    await request.clone().blob();
    const { id } = await params;
    
    const role = session.role || 'user';
    const phone = session.phone;

    const client = await Client.findById(id).populate({
      path: 'cars',
      populate: { path: 'images' }
    }).populate('documents');
    
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }
    const isPrivileged = checkPrivileged(session);
    if (!isPrivileged && client.createdByPhone && client.createdByPhone !== phone) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    // Also include cars linked through Delivery records for this client
    // Respect user isolation: for non-privileged, only their own deliveries (salesperson = current user)
    let salespersonFilter = {};
    if (!isPrivileged) {
      try {
        const u = await User.findOne({ phone }).select('_id');
        if (u?._id) salespersonFilter = { salesperson: u._id };
      } catch {}
    }
    const deliveries = await Delivery
      .find({ client: id, ...salespersonFilter })
      .populate({ path: 'car', populate: { path: 'images' } })
      .select('car');

    const carsFromDeliveries = deliveries
      .map(d => d.car)
      .filter(Boolean);

    // Merge client.cars and carsFromDeliveries by _id
    const seen = new Set();
    const mergedCars = [];
    const pushUnique = (car) => {
      try {
        const key = String(car._id);
        // Only include currently reserved cars as "associated"
        if (!seen.has(key) && String(car.status) === 'reserved') {
          seen.add(key);
          mergedCars.push(car);
        }
      } catch {}
    };
    if (Array.isArray(client.cars)) client.cars.forEach(pushUnique);
    carsFromDeliveries.forEach(pushUnique);

    const payload = {
      ...client.toObject(),
      cars: mergedCars,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update a client by ID
export async function PUT(request, { params }) {
  try {
    const session = await requireSession(request);
    await verifyActiveSession(session);
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.clone().blob();
    const { id } = await params;
    const body = await request.json();
    
    const role = session.role || 'user';
    const phone = session.phone;

    // Build $set and $unset updates; ignore immutable/owner fields
    const set = {};
    const unset = {};
    const optionalUnsettable = new Set(['email','lastName','notes']);
    for (const [key, value] of Object.entries(body || {})) {
      if (key === 'createdByPhone' || key === '_id' || key === 'createdAt' || key === 'updatedAt') continue;
      if (value === '' || value === null) {
        if (optionalUnsettable.has(key)) unset[key] = '';
        // skip setting empty values
        continue;
      }
      set[key] = value;
    }
    // Format phone number if provided in the effective set
    if (set.phone) {
      let phoneNumber = String(set.phone).trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      set.phone = phoneNumber;
    }

    // Enforce ownership for non-privileged users
    const isPrivileged = checkPrivileged(session);
    const filter = isPrivileged ? { _id: id } : { _id: id, createdByPhone: phone };

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const client = await Client.findOneAndUpdate(
      filter,
      update,
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
    const session = await requireSession(request);
    await verifyActiveSession(session);
    await connectToDatabase();
    // Workaround for Next.js bug where params cannot be accessed without awaiting request
    await request.blob();
    const { id } = await params;
    
    const role = session.role || 'user';
    const phone = session.phone;

    const isPrivileged = checkPrivileged(session);
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
