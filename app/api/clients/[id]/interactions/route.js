import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
  await request.clone().blob();
  const { id } = params;
  try {
    await connectToDatabase();
    const { note } = await request.json();

    if (!note) {
      return NextResponse.json({ success: false, message: 'Note is required.' }, { status: 400 });
    }

    const client = await Client.findById(id);

    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found.' }, { status: 404 });
    }

    client.interactionHistory.push({ note });
    await client.save();

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    console.error(`Error adding interaction to client ${id}:`, error);
    return NextResponse.json({ success: false, message: 'Failed to add interaction.' }, { status: 500 });
  }
}
