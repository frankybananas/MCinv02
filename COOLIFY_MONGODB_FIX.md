# MongoDB Connection Fix for Coolify Deployment

## Problem
```
Error: queryTxt ESERVFAIL cluster0.s6qmg.mongodb.net
```

This error means your Coolify server cannot connect to MongoDB Atlas due to DNS resolution or IP whitelist issues.

## Solution Steps

### 1. Get Your Coolify Server IP

SSH into your Coolify server or use the Coolify terminal and run:
```bash
curl -4 ifconfig.me
```

This will output your server's public IP address (e.g., `123.45.67.89`)

### 2. Add IP to MongoDB Atlas

1. Go to MongoDB Atlas → Network Access → IP Access List
2. Click **"+ ADD IP ADDRESS"** (green button)
3. Enter your Coolify server's IP address
4. Add comment: "Coolify Production Server"
5. Click **Confirm**

**Alternative (Testing Only):**
- To test if this fixes the issue, temporarily add `0.0.0.0/0` (allows all IPs)
- ⚠️ **Remove this after testing** and replace with your specific server IP

### 3. Update Environment Variables in Coolify

Your MongoDB connection string should be:
```
MONGODB_URI=mongodb+srv://user:pass@cluster0.s6qmg.mongodb.net/mcinv?retryWrites=true&w=majority&appName=Cluster0
```

Make sure this is set in Coolify's environment variables section.

### 4. Restart Application

After adding the IP to MongoDB Atlas:
1. In Coolify, go to your application
2. Click **Restart**
3. Monitor the logs for successful connection

## Code Changes Made

### 1. Enhanced MongoDB Connection (`lib/mongodb.ts`)
- Added `family: 4` to force IPv4 (prevents DNS issues)
- Added timeout configurations for better error handling
- Improved connection reliability in containerized environments

### 2. Fixed Duplicate Index Warning (`models/Session.ts`)
- Removed inline index on `expiresAt` field
- Added explicit TTL index using `schema.index()`
- Eliminates Mongoose duplicate index warning

## Verification

After the restart, you should see:
```
✓ Ready in ~1300ms
```

Without the DNS error. If you still see errors:

1. **Check MongoDB Atlas Status**: Ensure cluster is running (not paused)
2. **Verify IP Whitelist**: Double-check the IP was added correctly
3. **Test Connection String**: Try connecting from your local machine with the same string
4. **Check Coolify DNS**: Run `nslookup cluster0.s6qmg.mongodb.net` in Coolify terminal

## Additional Notes

- The duplicate schema index warning has been fixed
- Connection now uses IPv4 explicitly to avoid DNS resolution issues
- TTL index properly configured for automatic session cleanup
- All changes are backward compatible

## Support

If issues persist:
1. Check Coolify logs: `docker logs <container-name>`
2. Verify MongoDB Atlas cluster is in the same region (for better latency)
3. Consider using MongoDB Atlas connection string with `directConnection=true` for testing
