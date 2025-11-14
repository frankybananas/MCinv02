/**
 * MongoDB Connection Test Script
 * Run this in Coolify terminal to diagnose connection issues
 * 
 * Usage: node scripts/test-mongodb-connection.js
 */

const dns = require('dns');
const { MongoClient } = require('mongodb');

// Test DNS resolution first
async function testDNS() {
  console.log('🔍 Testing DNS resolution...\n');
  
  const hostname = 'cluster0.s6qmg.mongodb.net';
  
  // Test A records
  try {
    const addresses = await dns.promises.resolve4(hostname);
    console.log('✅ A Records resolved:', addresses);
  } catch (error) {
    console.error('❌ A Record resolution failed:', error.message);
  }
  
  // Test SRV records (required for mongodb+srv://)
  try {
    const records = await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
    console.log('✅ SRV Records resolved:', records.length, 'records');
    records.forEach((record, i) => {
      console.log(`   ${i + 1}. ${record.name}:${record.port}`);
    });
  } catch (error) {
    console.error('❌ SRV Record resolution failed:', error.message);
    console.log('   This is why mongodb+srv:// is failing!');
  }
  
  // Test TXT records
  try {
    const records = await dns.promises.resolveTxt(hostname);
    console.log('✅ TXT Records resolved:', records);
  } catch (error) {
    console.error('❌ TXT Record resolution failed:', error.message);
  }
  
  console.log('\n');
}

// Test MongoDB connection
async function testConnection() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }
  
  console.log('🔌 Testing MongoDB connection...');
  console.log('URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
  console.log('');
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, // Force IPv4
  });
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Test ping
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Ping successful!');
    
    // List databases
    const dbs = await client.db().admin().listDatabases();
    console.log('✅ Databases:', dbs.databases.map(db => db.name).join(', '));
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    
    if (error.message.includes('ESERVFAIL')) {
      console.log('\n💡 DNS resolution is failing. Possible solutions:');
      console.log('   1. Use standard connection string (mongodb:// instead of mongodb+srv://)');
      console.log('   2. Configure Docker DNS servers');
      console.log('   3. Check if DNS queries are blocked by firewall');
    }
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('MongoDB Connection Diagnostics');
  console.log('═══════════════════════════════════════════════════════\n');
  
  await testDNS();
  await testConnection();
  
  console.log('\n═══════════════════════════════════════════════════════');
}

main().catch(console.error);
