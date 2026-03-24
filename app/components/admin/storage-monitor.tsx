'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  HardDrive, 
  RefreshCw, 
  AlertCircle,
  Package,
  FolderOpen,
  Archive
} from 'lucide-react';

interface StorageStats {
  r2: {
    totalSizeBytes: number;
    totalSizeMB: number;
    totalSizeGB: number;
    objectCount: number;
    bucketName: string;
    error: string | null;
  };
  mongodb: {
    databaseName: string;
    totalSizeBytes: number;
    totalSizeMB: number;
    totalSizeGB: number;
    collections: Array<{
      name: string;
      count: number;
      sizeBytes: number;
      sizeMB: number;
    }>;
    error: string | null;
  };
  timestamp: string;
}

interface SoldCar {
  _id: string;
  make: string;
  carModel: string;
  year: number;
  price: number;
  soldDate: string;
  soldByUserName?: string;
  deliveryDate?: string;
  customerName?: string;
  // Preserved images
  coverImageUrl?: string;
  coverThumbnailUrl?: string;
  vinImageUrl?: string;
  vinThumbnailUrl?: string;
}

export default function StorageMonitor() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [soldCars, setSoldCars] = useState<SoldCar[]>([]);
  const [soldCarsPage, setSoldCarsPage] = useState(1);
  const [soldCarsTotalPages, setSoldCarsTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'sold'>('overview');

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/storage');
      
      if (!response.ok) {
        throw new Error('Failed to fetch storage stats');
      }
      
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load storage statistics');
      console.error('Storage stats error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSoldCars = async (page: number = 1) => {
    try {
      const response = await fetch(`/api/admin/sold-cars?page=${page}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch sold cars');
      }
      
      const result = await response.json();
      setSoldCars(result.data);
      setSoldCarsTotalPages(result.pagination.totalPages);
      setSoldCarsPage(page);
    } catch (err: any) {
      console.error('Sold cars fetch error:', err);
    }
  };

  const runCleanup = async () => {
    if (!confirm('Run cleanup job to archive sold cars older than 30 days? This will permanently delete car records and images.')) {
      return;
    }

    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/cleanup-sold-cars', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to run cleanup job');
      }
      
      const result = await response.json();
      alert(`Cleanup completed: ${result.details.carsArchived} cars archived, ${result.details.imagesDeleted} images deleted`);
      
      // Refresh stats and sold cars
      await fetchStats();
      if (activeTab === 'sold') {
        await fetchSoldCars(soldCarsPage);
      }
    } catch (err: any) {
      alert(`Cleanup failed: ${err.message}`);
      console.error('Cleanup error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'sold' && soldCars.length === 0) {
      fetchSoldCars(1);
    }
  }, [activeTab]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && !stats) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading storage statistics...</span>
        </div>
      </Card>
    );
  }

  if (error && !stats) {
    return (
      <Card className="p-6">
        <div className="flex items-center text-destructive">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
        <Button onClick={fetchStats} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Storage Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(stats.timestamp).toLocaleString('en-ZA')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runCleanup}
            variant="outline"
            disabled={refreshing}
          >
            <Archive className="h-4 w-4 mr-2" />
            Run Cleanup
          </Button>
          <Button
            onClick={fetchStats}
            variant="outline"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'collections'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveTab('sold')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'sold'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sold Cars Archive
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* R2 Storage Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Cloudflare R2 Storage</h3>
                <p className="text-sm text-muted-foreground">{stats.r2.bucketName}</p>
              </div>
            </div>

            {stats.r2.error ? (
              <div className="flex items-center text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                {stats.r2.error}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-bold">
                    {stats.r2.totalSizeGB.toFixed(2)} GB
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(stats.r2.totalSizeBytes)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{stats.r2.objectCount.toLocaleString()} objects</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">Average object size</div>
                  <div className="text-sm font-medium">
                    {stats.r2.objectCount > 0
                      ? formatBytes(stats.r2.totalSizeBytes / stats.r2.objectCount)
                      : '0 B'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* MongoDB Storage Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Database className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">MongoDB Storage</h3>
                <p className="text-sm text-muted-foreground">{stats.mongodb.databaseName}</p>
              </div>
            </div>

            {stats.mongodb.error ? (
              <div className="flex items-center text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                {stats.mongodb.error}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-bold">
                    {stats.mongodb.totalSizeMB.toFixed(2)} MB
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(stats.mongodb.totalSizeBytes)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  <span>{stats.mongodb.collections.length} collections</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">Largest collection</div>
                  <div className="text-sm font-medium">
                    {stats.mongodb.collections.length > 0
                      ? `${stats.mongodb.collections[0].name} (${formatBytes(stats.mongodb.collections[0].sizeBytes)})`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Collections Tab */}
      {activeTab === 'collections' && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">MongoDB Collections</h3>
          
          {stats.mongodb.error ? (
            <div className="flex items-center text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mr-2" />
              {stats.mongodb.error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Collection</th>
                    <th className="text-right py-3 px-4 font-medium">Documents</th>
                    <th className="text-right py-3 px-4 font-medium">Size</th>
                    <th className="text-right py-3 px-4 font-medium">Avg Doc Size</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.mongodb.collections.map((col) => (
                    <tr key={col.name} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-sm">{col.name}</td>
                      <td className="py-3 px-4 text-right">{col.count.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{formatBytes(col.sizeBytes)}</td>
                      <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                        {col.count > 0 ? formatBytes(col.sizeBytes / col.count) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Sold Cars Tab */}
      {activeTab === 'sold' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Sold Cars Archive</h3>
            <div className="text-sm text-muted-foreground">
              Page {soldCarsPage} of {soldCarsTotalPages}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Cover</th>
                  <th className="text-left py-3 px-4 font-medium">VIN</th>
                  <th className="text-left py-3 px-4 font-medium">Sold Date</th>
                  <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-left py-3 px-4 font-medium">Sold By</th>
                  <th className="text-left py-3 px-4 font-medium">Customer</th>
                </tr>
              </thead>
              <tbody>
                {soldCars.map((car) => (
                  <tr key={car._id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-4">
                      {car.coverThumbnailUrl || car.coverImageUrl ? (
                        <a href={car.coverImageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={car.coverThumbnailUrl || car.coverImageUrl} 
                            alt="Cover" 
                            className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">N/A</div>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      {car.vinThumbnailUrl || car.vinImageUrl ? (
                        <a href={car.vinImageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={car.vinThumbnailUrl || car.vinImageUrl} 
                            alt="VIN" 
                            className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">N/A</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">{formatDate(car.soldDate)}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{car.make} {car.carModel}</div>
                      <div className="text-sm text-muted-foreground">{car.year}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      R{car.price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm">{car.soldByUserName || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm">
                      <div>{car.customerName || 'N/A'}</div>
                      {car.deliveryDate && (
                        <div className="text-xs text-muted-foreground">
                          Delivered: {formatDate(car.deliveryDate)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {soldCarsTotalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <Button
                onClick={() => fetchSoldCars(soldCarsPage - 1)}
                disabled={soldCarsPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => fetchSoldCars(soldCarsPage + 1)}
                disabled={soldCarsPage === soldCarsTotalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
