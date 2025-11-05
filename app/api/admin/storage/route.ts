import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check authentication and admin access
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Import User model to check role
    const User = (await import('@/models/User')).default;
    await connect();
    
    const user = await User.findOne({ phone: session.phone });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get R2 storage stats
    let r2Stats = {
      totalSizeBytes: 0,
      totalSizeMB: 0,
      totalSizeGB: 0,
      objectCount: 0,
      bucketName: process.env.R2_BUCKET_NAME || 'Not configured',
      error: null as string | null,
    };

    try {
      if (process.env.R2_BUCKET_NAME && process.env.R2_ENDPOINT) {
        const { s3 } = await import('@/lib/s3');
        
        let continuationToken: string | undefined;
        let totalSize = 0;
        let totalCount = 0;

        // List all objects in bucket
        do {
          const command = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            ContinuationToken: continuationToken,
          });

          const response = await s3.send(command);
          
          if (response.Contents) {
            for (const obj of response.Contents) {
              totalSize += obj.Size || 0;
              totalCount++;
            }
          }

          continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        r2Stats.totalSizeBytes = totalSize;
        r2Stats.totalSizeMB = parseFloat((totalSize / (1024 * 1024)).toFixed(2));
        r2Stats.totalSizeGB = parseFloat((totalSize / (1024 * 1024 * 1024)).toFixed(2));
        r2Stats.objectCount = totalCount;
      } else {
        r2Stats.error = 'R2 not configured';
      }
    } catch (error: any) {
      console.error('R2 stats error:', error);
      r2Stats.error = error.message || 'Failed to fetch R2 stats';
    }

    // Get MongoDB storage stats
    let mongoStats = {
      databaseName: '',
      totalSizeBytes: 0,
      totalSizeMB: 0,
      totalSizeGB: 0,
      collections: [] as Array<{
        name: string;
        count: number;
        sizeBytes: number;
        sizeMB: number;
      }>,
      error: null as string | null,
    };

    try {
      await connect();
      const mongoose = await import('mongoose');
      const db = mongoose.default.connection.db;
      
      if (!db) {
        throw new Error('Database connection not established');
      }

      mongoStats.databaseName = db.databaseName;

      // Get database stats
      const dbStats = await db.stats();
      mongoStats.totalSizeBytes = dbStats.dataSize || 0;
      mongoStats.totalSizeMB = parseFloat((mongoStats.totalSizeBytes / (1024 * 1024)).toFixed(2));
      mongoStats.totalSizeGB = parseFloat((mongoStats.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2));

      // Get collection stats
      const collections = await db.listCollections().toArray();
      
      for (const col of collections) {
        try {
          const collection = db.collection(col.name);
          const count = await collection.countDocuments();
          
          // Use db.command to get collection stats
          const statsResult = await db.command({ collStats: col.name });
          
          mongoStats.collections.push({
            name: col.name,
            count: count,
            sizeBytes: statsResult.size || 0,
            sizeMB: parseFloat(((statsResult.size || 0) / (1024 * 1024)).toFixed(2)),
          });
        } catch (err) {
          console.error(`Error getting stats for collection ${col.name}:`, err);
        }
      }

      // Sort collections by size
      mongoStats.collections.sort((a, b) => b.sizeBytes - a.sizeBytes);

    } catch (error: any) {
      console.error('MongoDB stats error:', error);
      mongoStats.error = error.message || 'Failed to fetch MongoDB stats';
    }

    return NextResponse.json({
      success: true,
      r2: r2Stats,
      mongodb: mongoStats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Storage stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch storage stats' },
      { status: 500 }
    );
  }
}
