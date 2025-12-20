'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MainMenu } from '@/app/components/main-menu';
import type { DashboardTab, NotificationItem } from '@/app/types';

type AuditLogRow = {
  _id: string;
  eventType: string;
  phone?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type AuditLogResponse = {
  success: boolean;
  data?: AuditLogRow[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
};

const LAST_ACTIVE_TAB_STORAGE_KEY = 'mcinv:last-active-tab';

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-ZA');
}

function formatDetails(row: AuditLogRow): string {
  const metadata = (row.metadata || {}) as Record<string, any>;

  if (row.eventType === 'CAR_STATUS_CHANGE') {
    const make = typeof metadata.make === 'string' ? metadata.make : '';
    const model = typeof metadata.model === 'string' ? metadata.model : '';
    const year = typeof metadata.year === 'number' ? String(metadata.year) : '';
    const oldStatus = typeof metadata.oldStatus === 'string' ? metadata.oldStatus : '';
    const newStatus = typeof metadata.newStatus === 'string' ? metadata.newStatus : '';
    const carLabel = [year, make, model].filter(Boolean).join(' ');
    if (oldStatus || newStatus) {
      return `${carLabel} ${oldStatus} → ${newStatus}`.trim();
    }
    return carLabel || '—';
  }

  if (row.eventType === 'ROLE_CHANGE') {
    const oldRole = typeof metadata.oldRole === 'string' ? metadata.oldRole : '';
    const newRole = typeof metadata.newRole === 'string' ? metadata.newRole : '';
    const targetPhone = typeof metadata.targetPhone === 'string' ? metadata.targetPhone : '';
    return `${targetPhone} ${oldRole} → ${newRole}`.trim();
  }

  if (row.eventType === 'PERMISSIONS_CHANGE') {
    const targetPhone = typeof metadata.targetPhone === 'string' ? metadata.targetPhone : '';
    const changes = metadata.changes && typeof metadata.changes === 'object' ? Object.keys(metadata.changes) : [];
    return `${targetPhone} ${changes.join(', ')}`.trim();
  }

  if (row.eventType === 'USER_CREATED') {
    const targetPhone = typeof metadata.targetPhone === 'string' ? metadata.targetPhone : '';
    const role = typeof metadata.role === 'string' ? metadata.role : '';
    const department = typeof metadata.department === 'string' ? metadata.department : '';
    return `${targetPhone} (${role}${department ? `, ${department}` : ''})`.trim();
  }

  if (row.eventType === 'USER_DELETED') {
    const targetPhone = typeof metadata.targetPhone === 'string' ? metadata.targetPhone : '';
    const role = typeof metadata.role === 'string' ? metadata.role : '';
    return `${targetPhone}${role ? ` (${role})` : ''}`.trim();
  }

  if (row.eventType === 'OTP_REQUEST') {
    const success = metadata.success === true;
    const reason = typeof metadata.reason === 'string' ? metadata.reason : '';
    return `${success ? 'success' : 'fail'}${reason ? ` (${reason})` : ''}`;
  }

  if (row.eventType === 'LOGIN_FAIL') {
    const reason = typeof metadata.reason === 'string' ? metadata.reason : '';
    return reason || '—';
  }

  if (row.eventType === 'LOGIN_SUCCESS') {
    const role = typeof metadata.role === 'string' ? metadata.role : '';
    const deviceType = typeof metadata.deviceType === 'string' ? metadata.deviceType : '';
    return `${role}${deviceType ? ` (${deviceType})` : ''}`.trim() || '—';
  }

  const raw = JSON.stringify(metadata);
  if (!raw || raw === '{}') return '—';
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
}

export default function AuditLogPageShell() {
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

  const [rows, setRows] = React.useState<AuditLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [eventType, setEventType] = React.useState<string>('all');
  const [qDraft, setQDraft] = React.useState('');
  const [q, setQ] = React.useState('');

  const [selectedRow, setSelectedRow] = React.useState<AuditLogRow | null>(null);

  const loadAuditLogs = React.useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);

      const url = new URL('/api/admin/audit-log', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '50');
      url.searchParams.set('eventType', eventType);
      if (q) {
        url.searchParams.set('q', q);
      }

      const res = await fetch(url.toString());
      const json = (await res.json()) as AuditLogResponse;

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load audit log');
      }

      setRows(Array.isArray(json?.data) ? json.data : []);
      const pagination = json?.pagination;
      setTotalPages(typeof pagination?.totalPages === 'number' ? pagination.totalPages : 1);
      setTotalCount(typeof pagination?.totalCount === 'number' ? pagination.totalCount : 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventType, page, q]);

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
          console.error('Failed to load notifications for audit log menu', notifError);
        }
      } catch (authError) {
        console.error('Failed to load auth data for audit log menu', authError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const handleStatusFilterChange = React.useCallback((tab: DashboardTab) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, tab);
      router.push('/');
    } catch (navError) {
      console.error('Failed to navigate from audit log menu', navError);
      window.location.href = '/';
    }
  }, [router]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="min-h-screen bg-background pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7" />
            <h1 className="text-3xl font-bold">Audit Log</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadAuditLogs()} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh
            </Button>
            <Link href="/admin" passHref>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={eventType}
                onValueChange={(value) => {
                  setEventType(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="OTP_REQUEST">OTP_REQUEST</SelectItem>
                  <SelectItem value="LOGIN_SUCCESS">LOGIN_SUCCESS</SelectItem>
                  <SelectItem value="LOGIN_FAIL">LOGIN_FAIL</SelectItem>
                  <SelectItem value="ROLE_CHANGE">ROLE_CHANGE</SelectItem>
                  <SelectItem value="PERMISSIONS_CHANGE">PERMISSIONS_CHANGE</SelectItem>
                  <SelectItem value="USER_CREATED">USER_CREATED</SelectItem>
                  <SelectItem value="USER_DELETED">USER_DELETED</SelectItem>
                  <SelectItem value="CAR_STATUS_CHANGE">CAR_STATUS_CHANGE</SelectItem>
                </SelectContent>
              </Select>

              <Input
                className="h-11"
                placeholder="Search phone / user id"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setQ(qDraft);
                    setPage(1);
                  }
                }}
              />

              <div className="flex gap-2">
                <Button
                  className="h-11 flex-1"
                  onClick={() => {
                    setQ(qDraft);
                    setPage(1);
                  }}
                  disabled={refreshing}
                >
                  Search
                </Button>
                <Button
                  className="h-11"
                  variant="outline"
                  onClick={() => {
                    setQDraft('');
                    setQ('');
                    setPage(1);
                  }}
                  disabled={refreshing && qDraft === '' && q === ''}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {totalCount.toLocaleString()} events
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6">Loading…</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6">{error}</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Time</th>
                      <th className="text-left py-3 px-4 font-medium">Event</th>
                      <th className="text-left py-3 px-4 font-medium">Phone</th>
                      <th className="text-left py-3 px-4 font-medium">User ID</th>
                      <th className="text-left py-3 px-4 font-medium">IP</th>
                      <th className="text-left py-3 px-4 font-medium">Details</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row._id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                        <td className="py-3 px-4 font-mono text-xs">{row.eventType}</td>
                        <td className="py-3 px-4 font-mono text-xs">{row.phone || '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs">{row.userId || '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs">{row.ip || '—'}</td>
                        <td className="py-3 px-4 text-xs break-words overflow-wrap-anywhere leading-tight">{formatDetails(row)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRow(row)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td className="py-6 px-4 text-sm text-muted-foreground" colSpan={7}>
                          No events found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!canPrev}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={!canNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) setSelectedRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRow ? `${selectedRow.eventType} – ${formatDate(selectedRow.createdAt)}` : 'Event'}</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="font-medium">Phone:</span> {selectedRow.phone || '—'}</div>
                <div><span className="font-medium">User ID:</span> {selectedRow.userId || '—'}</div>
                <div><span className="font-medium">IP:</span> {selectedRow.ip || '—'}</div>
                <div className="truncate"><span className="font-medium">UA:</span> {selectedRow.userAgent || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Metadata</div>
                <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedRow.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
