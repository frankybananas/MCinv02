import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if MONGODB_URI is defined
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return NextResponse.json({ 
        success: false, 
        message: 'MONGODB_URI environment variable is not defined',
        troubleshooting: 'Make sure you have added MONGODB_URI to your .env.local file'
      }, { status: 500 });
    }
    
    // Mask the connection string for security while still showing format
    const maskedURI = MONGODB_URI.replace(
      /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
      'mongodb$1://$2:****@'
    );
    
    console.log('Attempting to connect to MongoDB with URI:', maskedURI);
    
    const mongoose = await connectToDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully connected to MongoDB Atlas',
      version: mongoose.version,
      connectionInfo: {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        readyState: mongoose.connection.readyState,
        readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
      },
      maskedURI: maskedURI
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    
    // Provide helpful troubleshooting information based on error type
    let troubleshooting = '';
    
    if (error.name === 'MongoServerSelectionError') {
      troubleshooting = 'Could not connect to any MongoDB server. Check your network connection, firewall settings, and make sure your IP address is whitelisted in MongoDB Atlas.';
    } else if (error.message && error.message.includes('Authentication failed')) {
      troubleshooting = 'Authentication failed. Check your username and password in the connection string.';
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      troubleshooting = 'Could not resolve the hostname. Check your cluster URL in the connection string.';
    } else if (error.message && error.message.includes('timed out')) {
      troubleshooting = 'Connection timed out. Check your network connection and make sure your IP address is whitelisted in MongoDB Atlas.';
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to connect to MongoDB Atlas',
      error: error.message,
      errorName: error.name,
      troubleshooting: troubleshooting || 'Check your MongoDB Atlas connection string and make sure your IP address is whitelisted.'
    }, { status: 500 });
  }
}
