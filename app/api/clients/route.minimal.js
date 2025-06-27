export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await connectToDatabase();
    const clients = await Client.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error('GET clients error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  console.log('Minimal client POST handler started');
  
  try {
    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);
    
    // Connect to database
    await connectToDatabase();
    console.log('Database connected');
    
    // Extract and normalize data
    const { name, phone } = body;
    
    // Split name into firstName and lastName
    const nameParts = name ? name.trim().split(' ') : ['Unknown'];
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';
    
    // Create a unique email if not provided
    const email = `user_${Date.now()}@placeholder.local`;
    
    console.log('Creating client with:', { firstName, lastName, email, phone });
    
    // Create client document
    const client = new Client({ 
      firstName, 
      lastName, 
      email,
      phone
    });
    
    // Save to database
    console.log('Saving client...');
    await client.save();
    console.log('Client saved successfully:', client._id);
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Client creation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors));
    }
    
    return NextResponse.json({
      success: false,
      message: error.message,
      name: error.name
    }, { status: 500 });
  }
}
