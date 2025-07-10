"use client";
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      router.replace('/auth/login');
      router.refresh();
      setLoading(false);
    }
  }, [router]);

  return { logout, loading };
}
