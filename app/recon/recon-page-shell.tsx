'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MainMenu } from '@/app/components/main-menu';
import Recon from '@/app/components/recon';
import type { DashboardTab, NotificationItem } from '@/app/types';

const LAST_ACTIVE_TAB_STORAGE_KEY = 'mcinv:last-active-tab';

const reconTab: DashboardTab = 'recon';

export default function ReconPageShell() {
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [todoEnabled, setTodoEnabled] = React.useState(false);
  const [marketingEnabled, setMarketingEnabled] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>('recon');

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
        setUserRole(typeof data?.role === 'string' ? data.role : 'recon');

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
          console.error('Failed to load notifications for recon menu', error);
        }
      } catch (error) {
        console.error('Failed to load auth data for recon menu', error);
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
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to navigate from recon menu', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto px-3 sm:px-4 pt-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Recon</h1>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
      <div className="mt-2">
        <Recon />
      </div>
      <MainMenu
        activeStatus={reconTab}
        onStatusFilterChange={handleStatusFilterChange}
        unreadNotificationsCount={unreadNotificationsCount}
        todoEnabled={todoEnabled}
        marketingEnabled={marketingEnabled}
        userRole={userRole}
      />
    </div>
  );
}
