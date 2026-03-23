"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreateUserForm from '@/app/components/admin/create-user-form';
import UserList from '@/app/components/admin/user-list';
import StorageMonitor from '@/app/components/admin/storage-monitor';
import SyncPanel from '@/app/components/admin/sync-panel';
import { MainMenu } from '@/app/components/main-menu';
import type { DashboardTab, NotificationItem } from '@/app/types';

const LAST_ACTIVE_TAB_STORAGE_KEY = 'mcinv:last-active-tab';
const adminTab: DashboardTab = 'admin';

export default function AdminPageShell() {
  const router = useRouter();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [todoEnabled, setTodoEnabled] = React.useState(false);
  const [marketingEnabled, setMarketingEnabled] = React.useState(false);
  // Initialize from localStorage to prevent flicker
  const [userRole, setUserRole] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('mcinv:user-role') || 'admin';
    }
    return 'admin';
  });

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
        // Update storage with fresh role
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
        } catch (error) {
          console.error('Failed to load notifications for admin menu', error);
        }
      } catch (error) {
        console.error('Failed to load auth data for admin menu', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusFilterChange = React.useCallback((tab: DashboardTab) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, tab);
      router.push('/');
    } catch (error) {
      console.error('Failed to navigate from admin menu', error);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <Link href="/admin/system" passHref>
              <Button variant="outline">System Health</Button>
            </Link>
            <Link href="/admin/audit-log" passHref>
              <Button variant="outline">Audit Log</Button>
            </Link>
          </div>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <p className="text-muted-foreground mb-6">Welcome to the admin panel. Here you can manage users and monitor storage.</p>
        <div className="space-y-8">
          <SyncPanel />
          <StorageMonitor />
          <CreateUserForm />
          <UserList />
        </div>
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
