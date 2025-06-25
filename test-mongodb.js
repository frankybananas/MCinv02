// Simple script to test MongoDB connection outside of Next.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('===== MongoDB Connection Test =====');
    console.log('MONGODB_URI defined:', !!process.env.MONGODB_URI);
    
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not defined in .env.local');
      process.exit(1);
    }
    
    // Mask the connection string for security while still showing format
    const maskedURI = process.env.MONGODB_URI.replace(
      /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
      'mongodb$1://$2:****@'
    );
    console.log('Using connection string:', maskedURI);
    
    // Parse the URI to check components
    const uriParts = process.env.MONGODB_URI.match(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
    if (uriParts) {
      console.log('URI components:');
      console.log('- Protocol:', uriParts[1] ? `mongodb+srv` : 'mongodb');
      console.log('- Username:', uriParts[2]);
      console.log('- Host:', uriParts[4]);
      console.log('- Database:', uriParts[5]);
    }
    
    console.log('\nAttempting to connect...');
    
    // Connect with detailed options
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4 // Use IPv4, skip trying IPv6
    });
    
    console.log('\n✅ CONNECTED SUCCESSFULLY!');
    console.log('Connection state:', mongoose.connection.readyState, '(1 = connected)');
    console.log('Database name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    
    // Try to access a collection to verify full connection
    console.log('\nChecking database collections...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length === 0) {
      console.log('No collections found (empty database)');
    } else {
      console.log('Available collections:', collections.map(c => c.name).join(', '));
    }
    
    console.log('\nClosing connection...');
    await mongoose.disconnect();
    console.log('✅ Disconnected successfully');
    console.log('\n===== Test Completed Successfully =====');
    
  } catch (error) {
    console.error('\n❌ CONNECTION ERROR');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('\nDIAGNOSIS: Could not connect to any MongoDB server.');
      console.error('POSSIBLE CAUSES:');
      console.error('1. Network connectivity issues');
      console.error('2. Firewall blocking the connection');
      console.error('3. IP address not whitelisted in MongoDB Atlas');
      console.error('4. MongoDB Atlas cluster is paused or unavailable');
    } else if (error.message && error.message.includes('Authentication failed')) {
      console.error('\nDIAGNOSIS: Authentication failed');
      console.error('POSSIBLE CAUSES:');
      console.error('1. Incorrect username in connection string');
      console.error('2. Incorrect password in connection string');
      console.error('3. User does not have access to the specified database');
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      console.error('\nDIAGNOSIS: Could not resolve the hostname');
      console.error('POSSIBLE CAUSES:');
      console.error('1. Incorrect cluster URL in connection string');
      console.error('2. DNS resolution issues');
    }
    
    console.error('\nFull error details:', JSON.stringify(error, null, 2));
  }
}

testConnection().catch(err => {
  console.error('Unhandled error in test script:', err);
  process.exit(1);
});
