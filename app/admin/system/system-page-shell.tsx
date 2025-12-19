'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Activity, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MainMenu } from '@/app/components/main-menu';
import type { DashboardTab, NotificationItem } from '@/app/types';

type SystemMetricsResponse = {
  success: boolean;
  cars?: { total: number; byStatus: Record<string, number> };
  clients?: { total: number };
  deliveries?: { total: number };
  images?: { total: number; totalSizeBytes: number; totalSizeMB: number };
  timestamp?: string;
  error?: string;
};

type CronStatusItem = {
  job: string;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  message: string | null;
  durationMs: number | null;
  updatedAt: string | null;
};

type CronStatusResponse = {
  success: boolean;
  data?: CronStatusItem[];
  timestamp?: string;
  error?: string;
};

const LAST_ACTIVE_TAB_STORAGE_KEY = 'mcinv:last-active-tab';

function formatNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return value.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusBadgeVariant(status: CronStatusItem['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'success') return 'default';
  if (status === 'running') return 'secondary';
  if (status === 'error') return 'destructive';
  return 'outline';
}

export default function SystemPageShell() {
  const router = useRouter();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [todoEnabled, setTodoEnabled] = React.useState(false);
  const [marketingEnabled, setMarketingEnabled] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('mcinv:user-role') || 'admin';
    }
    return 'admin';
  });

  const [metrics, setMetrics] = React.useState<SystemMetricsResponse | null>(null);
  const [cron, setCron] = React.useState<CronStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [metricsRes, cronRes] = await Promise.all([
        fetch('/api/admin/system-metrics'),
        fetch('/api/admin/cron-status'),
      ]);

      const metricsJson = (await metricsRes.json()) as SystemMetricsResponse;
      const cronJson = (await cronRes.json()) as CronStatusResponse;

      if (!metricsRes.ok) {
        throw new Error(metricsJson?.error || 'Failed to load system metrics');
      }
      if (!cronRes.ok) {
        throw new Error(cronJson?.error || 'Failed to load cron status');
      }

      setMetrics(metricsJson);
      setCron(cronJson);
    } catch (e: any) {
      setError(e?.message || 'Failed to load system health');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        const data = json?.data ?? {};
        const notificationsLastSeenAt = typeof data?.notificationsLastSeenAt === 'string' ? data.notificationsLastSeenAt : null;

        setTodoEnabled(data?.todoEnabled === true);
        setMarketingEnabled(data?.marketingEnabled === true);
        const role = typeof data?.role === 'string' ? data.role : 'admin';
        setUserRole(role);
        if (role && typeof window !== 'undefined') {
          window.localStorage.setItem('mcinv:user-role', role);
        }

        try {
          const notificationsRes = await fetch('/api/notifications');
          if (!notificationsRes.ok || cancelled) return;
          const notificationsJson = await notificationsRes.json();
          if (cancelled) return;
          const items: NotificationItem[] = Array.isArray(notificationsJson?.data) ? notificationsJson.data : [];
          const since = notificationsLastSeenAt ? new Date(notificationsLastSeenAt).getTime() : 0;
          const unread = items.filter((item) => {
            const createdAt = new Date(item.createdAt).getTime();
            return Number.isFinite(createdAt) && createdAt > since;
          }).length;
          setUnreadNotificationsCount(unread);
        } catch (notifError) {
          console.error('Failed to load notifications for system menu', notifError);
        }
      } catch (authError) {
        console.error('Failed to load auth data for system menu', authError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleStatusFilterChange = React.useCallback((tab: DashboardTab) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, tab);
      router.push('/');
    } catch (navError) {
      console.error('Failed to navigate from system menu', navError);
      window.location.href = '/';
    }
  }, [router]);

  const refresh = React.useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const metricsData = metrics?.cars && metrics?.clients && metrics?.deliveries ? metrics : null;
  const cronData = cron?.data;
  const cronRows = Array.isArray(cronData) ? cronData : [];

  return (
    <div className="min-h-screen bg-background pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7" />
            <h1 className="text-3xl font-bold">System Health</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh
            </Button>
            <Link href="/" passHref>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">Loading…</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6">{error}</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Cars</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{formatNumber(metricsData?.cars?.total)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Clients</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{formatNumber(metricsData?.clients?.total)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Deliveries</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{formatNumber(metricsData?.deliveries?.total)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Images (est.)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-2xl font-semibold">{formatNumber(metricsData?.images?.total)}</div>
                  <div className="text-sm text-muted-foreground">{formatBytes(metricsData?.images?.totalSizeBytes ?? 0)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cars by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(['in-stock', 'coming', 'reserved', 'sold'] as const).map((status) => (
                    <div key={status} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div className="text-sm text-muted-foreground">{status}</div>
                      <div className="text-lg font-semibold">{formatNumber(metricsData?.cars?.byStatus?.[status] ?? 0)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cron / Automation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cronRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No cron metadata recorded yet.</div>
                ) : (
                  <div className="space-y-3">
                    {cronRows.map((row) => (
                      <div key={row.job} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-semibold">{row.job}</div>
                          <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <span className="font-medium">Last run:</span> {formatDate(row.lastRunAt)}
                          </div>
                          <div>
                            <span className="font-medium">Last success:</span> {formatDate(row.lastSuccessAt)}
                          </div>
                          <div>
                            <span className="font-medium">Last error:</span> {formatDate(row.lastErrorAt)}
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span>{' '}
                            {typeof row.durationMs === 'number' ? `${Math.round(row.durationMs)} ms` : '—'}
                          </div>
                          <div className="sm:col-span-2 lg:col-span-2">
                            <span className="font-medium">Message:</span> {row.message || '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <MainMenu
        activeStatus="admin"
        onStatusFilterChange={handleStatusFilterChange}
        unreadNotificationsCount={unreadNotificationsCount}
        todoEnabled={todoEnabled}
        marketingEnabled={marketingEnabled}
        userRole={userRole}
      />
    </div>
  );
}
