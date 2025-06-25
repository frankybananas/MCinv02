import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  try {
    console.log('Starting DB collections API request');
    
    // Connect to database
    await connectToDatabase();
    console.log('Connected to database');
    
    // Get list of collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Collections found:', collectionNames);
    
    return NextResponse.json({ 
      success: true, 
      collections: collectionNames,
      modelNames: Object.keys(mongoose.models)
    });
  } catch (error) {
    console.error('DB Collections API Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
