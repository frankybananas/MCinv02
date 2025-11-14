# Coolify DNS Configuration for MongoDB Atlas

## Problem
`mongodb+srv://` requires DNS SRV record lookups, which may fail in Docker containers with restricted DNS access.

## Solution 1: Configure Docker DNS in Coolify

### Option A: Environment Variable Method

In Coolify, add these environment variables to your application:

```bash
# Use Google DNS servers
NODE_OPTIONS=--dns-result-order=ipv4first
```

### Option B: Docker Compose Override (if Coolify supports it)

If your Coolify deployment uses Docker Compose, you can add DNS configuration:

```yaml
services:
  app:
    dns:
      - 8.8.8.8
      - 8.8.4.4
      - 1.1.1.1
    dns_search:
      - .
```

### Option C: Coolify Docker Settings

Some Coolify versions allow Docker daemon configuration:

1. Go to Coolify Server Settings
2. Look for Docker configuration
3. Add DNS servers: `8.8.8.8`, `8.8.4.4`, `1.1.1.1`

---

## Solution 2: Test Connection (Recommended First Step)

Before making changes, diagnose the issue:

### In Coolify Terminal/SSH:

```bash
# Test DNS resolution
nslookup cluster0.s6qmg.mongodb.net

# Test SRV records (required for mongodb+srv://)
nslookup -type=SRV _mongodb._tcp.cluster0.s6qmg.mongodb.net

# Run our diagnostic script
node scripts/test-mongodb-connection.js
```

This will show you exactly what's failing.

---

## Solution 3: Alternative Connection String

If DNS configuration is not possible, construct a direct connection string.

### Get MongoDB Atlas Hostnames

1. In MongoDB Atlas, go to **Clusters** → **Overview**
2. Click on your cluster name
3. Look for **Connection** or **Metrics** tab
4. Find the actual hostnames (usually 3 nodes):
   - `cluster0-shard-00-00.s6qmg.mongodb.net:27017`
   - `cluster0-shard-00-01.s6qmg.mongodb.net:27017`
   - `cluster0-shard-00-02.s6qmg.mongodb.net:27017`

### Construct Standard Connection String

```bash
MONGODB_URI=mongodb://<username>:<password>@cluster0-shard-00-00.s6qmg.mongodb.net:27017,cluster0-shard-00-01.s6qmg.mongodb.net:27017,cluster0-shard-00-02.s6qmg.mongodb.net:27017/mcinv?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

**You need to find:**
- Replica set name (replace `atlas-xxxxx-shard-0`)
- Actual shard hostnames

---

## Solution 4: Use MongoDB Atlas Data API (Alternative)

If all else fails, use MongoDB Atlas Data API instead of direct connection:

1. Enable Data API in MongoDB Atlas
2. Use REST API calls instead of native driver
3. No DNS issues, works from any environment

---

## Recommended Steps

1. **First:** Run diagnostic script to confirm DNS is the issue
   ```bash
   node scripts/test-mongodb-connection.js
   ```

2. **Second:** Try the enhanced connection code (already updated in `lib/mongodb.ts`)
   - Commit and push changes
   - Restart in Coolify
   - Check logs

3. **Third:** If still failing, configure Docker DNS or use standard connection string

4. **Last Resort:** Use MongoDB Atlas Data API

---

## Current Connection String

Your connection string should be:

```bash
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.s6qmg.mongodb.net/mcinv?retryWrites=true&w=majority&appName=Cluster0
```

Replace `<username>` and `<password>` with actual credentials.

---

## Verification

After changes, you should see in Coolify logs:

```
[MongoDB] Attempting connection...
[MongoDB] ✅ Connected successfully
✓ Ready in ~1300ms
```

Without any `ESERVFAIL` errors.
