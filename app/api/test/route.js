export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

// Create a simple test schema
const TestSchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now }
});

// This is important - we're creating a model that doesn't conflict with existing ones
const Test = mongoose.models.Test || mongoose.model('Test', TestSchema);

export async function GET() {
  try {
    // Direct connection without using the helper
    console.log('Test route: Connecting directly to MongoDB');
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not defined');
    }
    
    // Connect with simple options
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: true,
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('Test route: Connected to MongoDB');
    
    // Try to create a simple document
    const testDoc = new Test({ name: 'Test ' + Date.now() });
    console.log('Test route: Saving test document');
    const saved = await testDoc.save();
    console.log('Test route: Document saved successfully', saved._id);
    
    // Find all test documents
    const allTests = await Test.find({}).sort({ createdAt: -1 });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test successful',
      savedId: saved._id,
      count: allTests.length,
      data: allTests
    });
  } catch (error) {
    console.error('Test route error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message,
      name: error.name,
      stack: error.stack
    }, { status: 500 });
  }
}
