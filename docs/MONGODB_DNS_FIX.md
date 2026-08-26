# MongoDB DNS Resolution Fix for Coolify

## Problem
Even with `0.0.0.0/0` in IP whitelist, getting:
```
Error: queryTxt ESERVFAIL cluster0.s6qmg.mongodb.net
```

This is a **DNS resolution issue in Docker**, not an IP whitelist problem.

## Solution Options

### Option 1: Use Standard Connection String (Recommended)

Instead of `mongodb+srv://` (which requires DNS SRV lookups), use the standard connection string format.

**Current (SRV format):**
```
mongodb+srv://user:pass@cluster0.s6qmg.mongodb.net/mcinv?retryWrites=true&w=majority&appName=Cluster0
```

**Replace with (Standard format):**
```
mongodb://user:pass@cluster0-shard-00-00.s6qmg.mongodb.net:27017,cluster0-shard-00-01.s6qmg.mongodb.net:27017,cluster0-shard-00-02.s6qmg.mongodb.net:27017/mcinv?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

**To get your standard connection string:**
1. Go to MongoDB Atlas → Clusters → Connect
2. Choose "Connect your application"
3. Select "Driver: Node.js"
4. Copy the connection string (NOT the SRV version)
5. Replace `<username>`, `<password>`, and `<dbname>`

### Option 2: Configure Docker DNS

Add DNS configuration to your Coolify deployment. In Coolify:

1. Go to your application settings
2. Add environment variable:
   ```
   DNS_SERVERS=8.8.8.8,8.8.4.4
   ```

3. Or add Docker DNS config (if Coolify supports it):
   ```json
   {
     "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
   }
   ```

### Option 3: Use MongoDB Atlas Private Endpoint

If your hosting provider supports it, set up a Private Endpoint in MongoDB Atlas to bypass DNS entirely.

## Recommended: Standard Connection String

The `mongodb+srv://` format requires DNS TXT and SRV record lookups, which can fail in restrictive Docker environments. The standard format uses direct hostnames and is more reliable.

### Steps:

1. **Get standard connection string from MongoDB Atlas**
2. **Update in Coolify environment variables:**
   ```
   MONGODB_URI=mongodb://user:pass@cluster0-shard-00-00.s6qmg.mongodb.net:27017,cluster0-shard-00-01.s6qmg.mongodb.net:27017,cluster0-shard-00-02.s6qmg.mongodb.net:27017/mcinv?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
   ```
3. **Restart application in Coolify**

## IP Whitelist Cleanup

Since you now have your specific server IP (`213.199.54.48/32`), you can:

**Keep:**
- `213.199.54.48/32` (LotLynx Server) - For your Coolify app
- Your personal IP OR `0.0.0.0/0` - For MongoDB Atlas console access

**Recommended:**
1. Remove `0.0.0.0/0`
2. Click "ADD IP ADDRESS" → "Add Current IP Address" to add your browser's IP
3. This allows console access from your location only (more secure)

**Note:** Removing `0.0.0.0/0` will NOT affect your app's connection - only your ability to access the MongoDB Atlas web console from different locations.

## Verification

After switching to standard connection string:
```bash
# In Coolify logs, you should see:
✓ Ready in ~1300ms

# Without DNS errors
```

## Why This Happens

- `mongodb+srv://` requires DNS SRV record lookups
- Docker containers in Coolify may have restricted DNS resolution
- Mongoose 8.x may have stricter DNS requirements
- Standard connection string bypasses DNS SRV lookups entirely
