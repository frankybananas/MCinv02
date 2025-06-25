import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple response without any database operations
    return NextResponse.json({ 
      success: true, 
      message: "Basic API test endpoint working", 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Test API Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
