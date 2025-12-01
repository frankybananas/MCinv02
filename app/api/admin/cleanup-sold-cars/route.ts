import { NextResponse } from 'next/server';
import { connect } from '@/lib/mongodb';
import SoldCar from '@/models/SoldCar';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Verify authorization header (for cron jobs or internal calls)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connect();
    const Car = (await import('@/models/Car')).default;
    const Picture = (await import('@/models/Picture')).default;
    const User = (await import('@/models/User')).default;

    // Find cars with status 'sold' that were marked sold more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get sold cars older than 30 days
    // Use soldAt field to determine when car was marked as sold
    const soldCars = await Car.find({
      status: 'sold',
      soldAt: { $ne: null, $lt: thirtyDaysAgo },
    }).populate('images').lean();

    console.log(`Found ${soldCars.length} sold cars older than 30 days to archive`);

    const archivedCount = {
      cars: 0,
      images: 0,
      errors: [] as string[],
    };

    for (const car of soldCars) {
      try {
        // Get user info for sold record
        let soldByUserName = 'Unknown';
        const auditLog = car.auditLog || [];
        const soldAudit = auditLog.find((log: any) => 
          log.action === 'status_change' && log.details?.includes('sold')
        );
        
        if (soldAudit?.user) {
          const user = await User.findOne({ phone: soldAudit.user });
          if (user?.profile?.firstName && user?.profile?.lastName) {
            soldByUserName = `${user.profile.firstName} ${user.profile.lastName}`;
          } else {
            soldByUserName = soldAudit.user;
          }
        }

        // Get delivery date if exists
        const Delivery = (await import('@/models/Delivery')).default;
        const delivery: any = await Delivery.findOne({ car: (car as any)._id }).lean();

        // Identify Cover and VIN images to preserve
        const images = Array.isArray(car.images) ? car.images : [];
        const coverIdx = typeof car.coverImageIndex === 'number' ? car.coverImageIndex : 0;
        const vinIdx = typeof car.vinImageIndex === 'number' ? car.vinImageIndex : null;
        
        // Get Cover image (defaults to first image if coverImageIndex not set)
        const coverImage = images[coverIdx] || images[0] || null;
        // Get VIN image if specified
        const vinImage = vinIdx !== null ? images[vinIdx] : null;
        
        // Extract preserved image URLs
        const coverImageUrl = coverImage?.imageUrl || null;
        const coverThumbnailUrl = coverImage?.thumbnailUrl || null;
        const vinImageUrl = vinImage?.imageUrl || null;
        const vinThumbnailUrl = vinImage?.thumbnailUrl || null;
        
        // Create archive record with preserved images
        const soldCarRecord = new SoldCar({
          originalCarId: (car as any)._id.toString(),
          make: car.make,
          carModel: car.model,
          year: car.year,
          price: car.price,
          kilometers: car.kilometers,
          color: car.color,
          soldDate: car.soldAt || car.updatedAt, // Use soldAt if available, fallback to updatedAt
          soldByUser: soldAudit?.user || 'Unknown',
          soldByUserName,
          deliveryDate: delivery?.deliveryDate || null,
          finalPrice: car.price,
          customerName: delivery?.customerName || null,
          notes: car.notes || null,
          // Preserved images
          coverImageUrl,
          coverThumbnailUrl,
          vinImageUrl,
          vinThumbnailUrl,
        });

        await soldCarRecord.save();
        archivedCount.cars++;

        // Delete images from R2 (except Cover and VIN)
        const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
        
        // Collect URLs to preserve (don't delete from R2)
        const preservedUrls = new Set<string>([
          coverImageUrl, coverThumbnailUrl, vinImageUrl, vinThumbnailUrl
        ].filter(Boolean) as string[]);

        for (let i = 0; i < images.length; i++) {
          const pic = images[i];
          try {
            if (!pic || typeof pic !== 'object') continue;

            const imageUrl = (pic as any).imageUrl || '';
            const thumbnailUrl = (pic as any).thumbnailUrl || '';
            
            // Check if this image should be preserved
            const isPreserved = preservedUrls.has(imageUrl) || preservedUrls.has(thumbnailUrl);

            // Delete from R2 only if not preserved
            if (process.env.R2_BUCKET_NAME && !isPreserved) {
              const { s3 } = await import('@/lib/s3');
              
              for (const url of [imageUrl, thumbnailUrl]) {
                if (!url || preservedUrls.has(url)) continue;
                
                let key = '';
                if (publicBase && url.startsWith(publicBase + '/')) {
                  key = url.substring(publicBase.length + 1);
                } else {
                  const idx = url.indexOf('pictures/');
                  if (idx >= 0) key = url.substring(idx);
                }

                if (key) {
                  try {
                    await s3.send(new DeleteObjectCommand({
                      Bucket: process.env.R2_BUCKET_NAME,
                      Key: key,
                    }));
                    archivedCount.images++;
                  } catch (err) {
                    console.error(`Failed to delete R2 object ${key}:`, err);
                  }
                }
              }
            }

            // Delete Picture document (all of them, URLs are preserved in SoldCar)
            if ((pic as any)._id) {
              await Picture.findByIdAndDelete((pic as any)._id);
            }
          } catch (err: any) {
            console.error(`Error deleting image:`, err);
            archivedCount.errors.push(`Image deletion error: ${err.message}`);
          }
        }

        // Delete the car document
        await Car.findByIdAndDelete((car as any)._id);

      } catch (err: any) {
        console.error(`Error archiving car ${(car as any)._id}:`, err);
        archivedCount.errors.push(`Car ${(car as any)._id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Archived ${archivedCount.cars} sold cars`,
      details: {
        carsArchived: archivedCount.cars,
        imagesDeleted: archivedCount.images,
        errors: archivedCount.errors,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Cleanup job error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run cleanup job' },
      { status: 500 }
    );
  }
}
