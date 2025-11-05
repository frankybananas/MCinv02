# Storage Monitoring & Automated Cleanup System

## Overview
This document describes the storage monitoring dashboard and automated cleanup system implemented for the MCinv02 application.

## Features

### 1. Storage Monitoring Dashboard (Admin Only)

Located in the Admin Panel, this dashboard provides real-time insights into storage usage across both Cloudflare R2 and MongoDB.

#### R2 Storage Metrics
- **Total Storage Size**: Displayed in GB, MB, and bytes
- **Object Count**: Total number of files stored
- **Bucket Name**: Current R2 bucket being used
- **Average Object Size**: Calculated metric for storage optimization

#### MongoDB Metrics
- **Database Size**: Total data size in MB
- **Collections Overview**: Detailed breakdown per collection
  - Document count
  - Storage size
  - Average document size
- **Sorted by Size**: Collections listed from largest to smallest

#### Sold Cars Archive
- **Historical Record**: All cars that have been archived after 30 days
- **Searchable & Paginated**: Easy to find specific vehicles
- **Key Information Displayed**:
  - Sold date
  - Vehicle details (Make, Model, Year)
  - Sale price
  - Salesperson name
  - Customer name (if available)
  - Delivery date (if available)

### 2. Automated Cleanup System

#### 30-Day Sold Car Archival Process

When a car's status is changed to "sold":
1. The `soldAt` timestamp is automatically recorded
2. The car remains visible in the normal inventory for 30 days
3. After 30 days:
   - An automated cleanup job archives the car to the SoldCar collection
   - All associated images are deleted from R2 storage
   - Picture documents are removed from MongoDB
   - The original car document is deleted
   - Only the archive record remains (visible to Admins only)

#### What Gets Archived
- Original car ID
- Make, Model, Year
- Sale price
- Kilometers
- Color
- Sold date and salesperson information
- Delivery date (if exists)
- Customer name (if exists)
- Notes

#### What Gets Deleted
- High-resolution car images from R2
- Thumbnail images from R2
- Picture documents from MongoDB
- Original car document
- Associated delivery records

### 3. Orphaned File Cleanup

When a car is deleted by an Admin:
- All associated images are automatically deleted from R2
- Picture documents are removed from MongoDB
- Delivery records are cleaned up
- Client associations are updated
- WhatsApp generation references are removed

This ensures no orphaned files remain in storage.

## API Endpoints

### Storage Monitoring
```
GET /api/admin/storage
Authorization: Admin role required
Response: {
  r2: { /* R2 statistics */ },
  mongodb: { /* MongoDB statistics */ },
  timestamp: ISO date string
}
```

### Sold Cars History
```
GET /api/admin/sold-cars?page=1&limit=50&search=query
Authorization: Admin role required
Response: {
  data: Array<SoldCar>,
  pagination: { /* pagination info */ }
}
```

### Cleanup Job
```
POST /api/admin/cleanup-sold-cars
Authorization: Bearer <CRON_SECRET>
Response: {
  carsArchived: number,
  imagesDeleted: number,
  errors: Array<string>
}
```

## Database Schema

### SoldCar Collection
```typescript
{
  originalCarId: string;      // Original MongoDB _id
  make: string;
  carModel: string;
  year: number;
  price: number;
  kilometers?: number;
  color?: string;
  soldDate: Date;            // When marked as sold
  soldByUser: string;        // Phone number
  soldByUserName?: string;   // User's full name
  deliveryDate?: Date;
  finalPrice?: number;
  customerName?: string;
  notes?: string;
  archivedAt: Date;          // When archived
  createdAt: Date;
}
```

### Car Model Updates
Added field:
```javascript
soldAt: {
  type: Date,
  default: null,
}
```

This field is automatically set when status changes to 'sold' and cleared if status changes away from 'sold'.

## Cron Job Setup

To automate the cleanup process, set up a cron job to call the cleanup endpoint:

### Using a Service (Recommended)

#### Option 1: Coolify Cron Service
If using Coolify:
1. Add a new cron service to your deployment
2. Schedule: `0 2 * * *` (runs at 2 AM daily)
3. Command: 
```bash
curl -X POST https://your-domain.com/api/admin/cleanup-sold-cars \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

#### Option 2: External Cron Service (e.g., cron-job.org)
1. Create account at cron-job.org or similar
2. Add new cron job
3. URL: `https://your-domain.com/api/admin/cleanup-sold-cars`
4. Schedule: Once daily
5. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

### Environment Variables Required
```env
CRON_SECRET=your-secure-random-secret
# (fallback to NEXTAUTH_SECRET if CRON_SECRET not set)
```

## Usage

### Admin Panel Access
1. Log in as an Admin user
2. Navigate to Admin Panel
3. The Storage Monitoring section appears at the top

### Manual Cleanup
If needed, Admins can manually trigger the cleanup:
1. Go to Admin Panel → Storage Monitoring
2. Click "Run Cleanup" button
3. Confirm the action
4. View results in the notification

### Viewing Sold Cars Archive
1. Go to Admin Panel → Storage Monitoring
2. Click "Sold Cars Archive" tab
3. Use search and pagination to find specific vehicles

## Image Optimization

### OptimizedImage Component
A new component for lazy loading and progressive image loading:

```tsx
import OptimizedImage from '@/app/components/optimized-image';

<OptimizedImage
  src="/path/to/full-image.webp"
  thumbnailSrc="/path/to/thumbnail.webp"
  alt="Car image"
  width={800}
  height={600}
  priority={false} // Set true for above-the-fold images
/>
```

#### Features:
- **Lazy Loading**: Images load only when entering viewport
- **Progressive Loading**: Shows thumbnail first, then full image
- **Intersection Observer**: Efficient viewport detection
- **Blur Placeholder**: Smooth loading experience
- **Next.js Image**: Built on top of Next.js Image component

## Performance Considerations

### Storage Monitoring
- R2 listing operations can be slow with many objects
- MongoDB stats are cached for 5 minutes (recommended)
- Refresh button available for real-time data

### Cleanup Job
- Runs asynchronously
- Processes cars in batches
- Best-effort deletion (continues on errors)
- Logs all errors for review

## Security

### Authorization
- Storage monitoring: Admin role required
- Sold cars history: Admin role required
- Cleanup job: Secret token required (CRON_SECRET)
- Car deletion: Admin/Manager roles only

### Data Retention
- Sold cars archived permanently (not auto-deleted)
- Images deleted permanently from R2 (no recovery)
- Admins can export sold car data if needed

## Troubleshooting

### Cleanup Not Running
1. Check CRON_SECRET is set correctly
2. Verify cron job is hitting the endpoint
3. Check application logs for errors
4. Manually trigger from Admin Panel to test

### Storage Stats Not Loading
1. Check R2 credentials are configured
2. Verify MongoDB connection
3. Check browser console for errors
4. Try refresh button

### Images Not Deleting
1. Verify R2 credentials have delete permissions
2. Check R2_PUBLIC_URL is correctly configured
3. Review cleanup job error logs

## Future Enhancements

- [ ] Email notifications for cleanup job results
- [ ] Storage usage alerts when thresholds exceeded
- [ ] Sold car data export to CSV/Excel
- [ ] Image CDN integration for better performance
- [ ] Automated image optimization on upload
- [ ] Storage usage trends and analytics

## Related Files

### Models
- `/models/SoldCar.ts` - Archived car schema
- `/models/Car.js` - Updated with soldAt field

### API Routes
- `/app/api/admin/storage/route.ts` - Storage monitoring
- `/app/api/admin/sold-cars/route.ts` - Sold cars history
- `/app/api/admin/cleanup-sold-cars/route.ts` - Cleanup job
- `/app/api/cars/[id]/route.js` - Updated with soldAt tracking

### Components
- `/app/components/admin/storage-monitor.tsx` - Dashboard UI
- `/app/components/optimized-image.tsx` - Image optimization component

### Pages
- `/app/admin/page.tsx` - Updated with storage monitor

## Support

For issues or questions, contact the development team or create an issue in the project repository.

---

**Last Updated**: November 2024  
**Version**: 1.0.0
