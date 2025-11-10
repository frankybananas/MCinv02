"use client";

import React from 'react';
import { useState, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { LoginForm } from './login-form';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab, Delivery, NotificationItem } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const LAST_ACTIVE_TAB_STORAGE_KEY = 'mcinv:last-active-tab';

const PERSISTABLE_TABS: DashboardTab[] = [
  'all',
  'in-stock',
  'coming',
  'reserved',
  'sold',
  'demo',
  'clients',
  'delivery',
  'notifications',
  'todo',
  'marketing',
];

const isPersistableTab = (value: string): value is DashboardTab =>
  PERSISTABLE_TABS.includes(value as DashboardTab);

// Lazy load heavy components to reduce initial bundle size
const Dashboard = lazy(() => import('./dashboard').then(module => ({ default: module.Dashboard })));
const DeliveryDetail = lazy(() => import('./delivery-detail').then(module => ({ default: module.DeliveryDetail })));
const CarDetail = lazy(() => import('./car-detail').then(module => ({ default: module.CarDetail })));
const ClientDetail = lazy(() => import('./client-detail').then(module => ({ default: module.ClientDetail })));
const AddEditCar = lazy(() => import('./add-edit-car').then(module => ({ default: module.AddEditCar })));
const AddEditClient = lazy(() => import('./add-edit-client').then(module => ({ default: module.AddEditClient })));

// Loading component
const ComponentLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

interface MainPageProps {
  initialIsAuthenticated: boolean;
  userRole: string | null;
}

export default function MainPage({ initialIsAuthenticated, userRole }: MainPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [currentUserPhone, setCurrentUserPhone] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLastSeenAt, setNotificationsLastSeenAt] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<DashboardTab>('all');
  const [todoEnabled, setTodoEnabled] = useState<boolean>(false);
  const [marketingEnabled, setMarketingEnabled] = useState<boolean>(false);
  const [role, setRole] = useState<string | null>(userRole);
  const hasRestoredLastTab = useRef(false);

  // Compute unread count consistently on every render (top-level hook)
  const unreadNotificationsCount = useMemo(() => {
    const since = notificationsLastSeenAt ? new Date(notificationsLastSeenAt).getTime() : 0;
    return notifications.filter(n => {
      const t = new Date(n.createdAt).getTime();
      return Number.isFinite(t) && t > since;
    }).length;
  }, [notifications, notificationsLastSeenAt]);

  // Reserve flow: prompt for client linking
  const [reserveCarId, setReserveCarId] = useState<string | null>(null);
  const [selectedClientIdForReserve, setSelectedClientIdForReserve] = useState<string | null>(null);
  // If user chooses to create a client from the reserve dialog, remember the car to offer "Reserve now" after save
  const [pendingReserveCarId, setPendingReserveCarId] = useState<string | null>(null);

  // Ensure clients are loaded when opening the reserve dialog
  useEffect(() => {
    if (reserveCarId && clients.length === 0) {
      (async () => {
        try {
          const res = await fetch('/api/clients');
          if (res.ok) {
            const json = await res.json();
            setClients(json.data || []);
          }
        } catch {}
      })();
    }
  }, [reserveCarId]);

  // Refetch selectedClient with full data when clients array updates
  useEffect(() => {
    if (selectedClient && selectedClient._id) {
      // Refetch the full client data with populated cars
      (async () => {
        try {
          const res = await fetch(`/api/clients/${selectedClient._id}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              setSelectedClient(json.data);
            }
          }
        } catch (error) {
          console.error('Error refetching client details:', error);
        }
      })();
    }
  }, [clients]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      } else {
        console.error('Logout failed');
      }
    } catch (err) {
      console.error('An error occurred during logout:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch cars first as they're most commonly needed
      const carsRes = await fetch('/api/cars');
      if (!carsRes.ok) throw new Error('Failed to fetch cars');
      const carsData = await carsRes.json();
      setCars(carsData.data || []);

      // Then fetch other data in parallel
      const [clientsRes, deliveriesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/deliveries'),
      ]);

      if (!clientsRes.ok || !deliveriesRes.ok) {
        throw new Error('Failed to fetch additional data');
      }

      const clientsData = await clientsRes.json();
      const deliveriesData = await deliveriesRes.json();

      setClients(clientsData.data || []);
      setDeliveries(deliveriesData.data || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Fetch error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderReserveDialog = () => (
    <Dialog open={!!reserveCarId} onOpenChange={(open) => { if (!open) { setReserveCarId(null); setSelectedClientIdForReserve(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-10">Link a Client to reserve this car</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(() => { /* compute visible clients once for rendering */ return null })()}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Select one of your clients to link to this reservation.</p>
            <Button
              size="sm"
              onClick={() => {
                // Close dialog and open create-client flow
                setReserveCarId(null);
                setSelectedClientIdForReserve(null);
                setPendingReserveCarId(reserveCarId);
                setEditingClient({} as Client);
              }}
            >
              Create client
            </Button>
          </div>
          {(() => {
            // Server already filters clients for non-privileged users. Use as-is.
            const visibleClients = clients;
            return (
            <div className="max-h-64 overflow-auto border rounded-md divide-y">
            {visibleClients
              .map(c => (
                <button
                  key={c._id}
                  className={`w-full text-left px-3 py-2 hover:bg-accent/60 transition-colors ${selectedClientIdForReserve === c._id ? 'bg-accent' : 'bg-background'}`}
                  onClick={() => setSelectedClientIdForReserve(c._id as unknown as string)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.firstName} {c.lastName}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || c.email}</div>
                    </div>
                    <div className={`h-3.5 w-3.5 rounded-full border ${selectedClientIdForReserve === c._id ? 'bg-blue-600 border-blue-600' : 'border-muted-foreground/30'}`} />
                  </div>
                </button>
              ))}
            {visibleClients.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground flex items-center justify-between gap-3">
                <span>You have no clients yet.</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setReserveCarId(null);
                    setSelectedClientIdForReserve(null);
                    setPendingReserveCarId(reserveCarId);
                    setEditingClient({} as Client);
                  }}
                >
                  Create client
                </Button>
              </div>
            )}
            </div>
            )})()}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setReserveCarId(null); setSelectedClientIdForReserve(null); }}>Cancel</Button>
            <Button
              disabled={!selectedClientIdForReserve || !reserveCarId}
              onClick={async () => {
                if (!reserveCarId || !selectedClientIdForReserve) return;
                try {
                  const res = await fetch(`/api/cars/${reserveCarId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-user-name': currentUserName || 'unknown',
                      'x-user-phone': currentUserPhone || 'unknown',
                      'x-user-role': userRole || 'user',
                    },
                    body: JSON.stringify({ status: 'reserved', clientId: selectedClientIdForReserve }),
                  });
                  if (res.ok) {
                    await fetchData();
                    setReserveCarId(null);
                    setSelectedClientIdForReserve(null);
                  } else {
                    console.error('Reserve failed', await res.text());
                  }
                } catch (e) {
                  console.error('Reserve error', e);
                }
              }}
            >
              Select Client
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const handleAddInteraction = async (clientId: string, note: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error('Failed to add interaction');
      const json = await res.json();
      const updated: Client = json.data;
      setEditingClient(updated);
      // Also reflect in the main clients list if present
      setClients((prev) => prev.map(c => (c._id === updated._id ? updated : c)));
    } catch (err) {
      console.error('Error adding interaction:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const j = await res.json();
      setNotifications(Array.isArray(j?.data) ? j.data : []);
    } catch {}
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const nowIso = new Date().toISOString();
      setNotificationsLastSeenAt(nowIso);
      const res = await fetch('/api/notifications/seen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: nowIso }),
      });
      if (res.ok) {
        const j = await res.json();
        const serverTs = j?.data?.notificationsLastSeenAt as string | undefined;
        if (serverTs) setNotificationsLastSeenAt(serverTs);
      }
    } catch {}
  };

  const handleNotificationDone = async (n: NotificationItem) => {
    try {
      const res = await fetch('/api/notifications/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n._id, done: true }),
      });
      if (!res.ok) return;
      // Optimistically remove from local list
      setNotifications((prev) => prev.filter((x) => x._id !== n._id));
    } catch {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      // Preload notifications in the background
      void fetchNotifications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (hasRestoredLastTab.current) return;
    if (!authChecked) return;
    if (typeof window === 'undefined') return;

    const storedTab = window.localStorage.getItem(LAST_ACTIVE_TAB_STORAGE_KEY);
    if (!storedTab || !isPersistableTab(storedTab)) {
      hasRestoredLastTab.current = true;
      return;
    }

    if ((storedTab === 'todo' && !todoEnabled) || (storedTab === 'marketing' && !marketingEnabled)) {
      window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, 'all');
      hasRestoredLastTab.current = true;
      return;
    }

    setActiveStatus(storedTab);
    hasRestoredLastTab.current = true;
  }, [authChecked, todoEnabled, marketingEnabled, setActiveStatus]);

  useEffect(() => {
    if ((!todoEnabled && activeStatus === 'todo') || (!marketingEnabled && activeStatus === 'marketing')) {
      setActiveStatus('all');
    }
  }, [todoEnabled, marketingEnabled, activeStatus]);

  useEffect(() => {
    if (!hasRestoredLastTab.current) return;
    if (typeof window === 'undefined') return;
    if ((activeStatus === 'todo' && !todoEnabled) || (activeStatus === 'marketing' && !marketingEnabled)) return;

    window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, activeStatus);
  }, [activeStatus, todoEnabled, marketingEnabled]);

  // Refresh data when switching to delivery tab
  useEffect(() => {
    if (isAuthenticated && activeStatus === 'delivery') {
      fetchData();
    }
  }, [activeStatus, isAuthenticated]);

  // Refresh notifications when switching to notifications tab
  useEffect(() => {
    if (isAuthenticated && activeStatus === 'notifications') {
      fetchNotifications();
      // Mark as read when user opens the Notifications tab
      const nowIso = new Date().toISOString();
      setNotificationsLastSeenAt(nowIso);
      // Persist last seen to server (fire-and-forget)
      (async () => {
        try {
          const res = await fetch('/api/notifications/seen', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timestamp: nowIso }),
          });
          if (res.ok) {
            const j = await res.json();
            const serverTs = j?.data?.notificationsLastSeenAt as string | undefined;
            if (serverTs) setNotificationsLastSeenAt(serverTs);
          }
        } catch {}
      })();
    }
  }, [activeStatus, isAuthenticated]);

  // Check authentication status and fetch current user info
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const j = await res.json();
          const data = j?.data as { phone?: string; firstName?: string; lastName?: string; notificationsLastSeenAt?: string | null; todoEnabled?: boolean; marketingEnabled?: boolean; role?: string | null } | undefined;
          const phone = data?.phone as string | undefined;
          const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
          if (mounted) {
            setIsAuthenticated(true);
            if (phone) setCurrentUserPhone(phone);
            if (name) setCurrentUserName(name);
            if (typeof data?.notificationsLastSeenAt === 'string') setNotificationsLastSeenAt(data.notificationsLastSeenAt);
            setTodoEnabled(data?.todoEnabled === true);
            setMarketingEnabled(data?.marketingEnabled === true);
            setRole(typeof data?.role === 'string' ? data.role : null);
            setAuthChecked(true);
          }
        } else {
          if (mounted) {
            setIsAuthenticated(false);
            setAuthChecked(true);
          }
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      }
    };
    checkAuth();
    return () => { mounted = false; };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setAuthChecked(true);
    // Re-fetch user data after successful login
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const j = await res.json();
          const data = j?.data as { phone?: string; firstName?: string; lastName?: string; notificationsLastSeenAt?: string | null; todoEnabled?: boolean; marketingEnabled?: boolean; role?: string | null } | undefined;
          const phone = data?.phone as string | undefined;
          const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
          if (phone) setCurrentUserPhone(phone);
          if (name) setCurrentUserName(name);
          if (typeof data?.notificationsLastSeenAt === 'string') setNotificationsLastSeenAt(data.notificationsLastSeenAt);
          setTodoEnabled(data?.todoEnabled === true);
          setMarketingEnabled(data?.marketingEnabled === true);
          setRole(typeof data?.role === 'string' ? data.role : null);
        }
      } catch (error) {
        console.error('Error fetching user data after login:', error);
      }
    };
    fetchUserData();
  };

  const handleCarSelect = (car: Car) => {
    setSelectedCar(car);
    setSelectedClient(null);
    setSelectedDelivery(null);
  };

  const handleAddCar = () => setEditingCar({} as Car);
  const handleAddClient = () => setEditingClient({} as Client);

  const handleStatusChange = async (carId: string, status: CarState) => {
    try {
      // For "reserved", require linking to a client first
      if (status === 'reserved') {
        setReserveCarId(carId);
        return;
      }

      const response = await fetch(`/api/cars/${carId}`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-name': currentUserName || 'unknown',
            'x-user-phone': currentUserPhone || 'unknown',
            'x-user-role': userRole || 'user',
          },
          body: JSON.stringify({ status }),
        });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();
      const updatedCar = result.data as Car;

      setCars(currentCars => currentCars.map(car => (car._id === carId ? updatedCar : car)));

      if (selectedCar?._id === carId) {
        setSelectedCar(updatedCar);
      }

      // Auto-create or upsert a delivery when sold. The 'reserved' flow is handled via the
      // dedicated reserve dialog and server-side upsert logic.
      if (status === 'sold') {
        const res = await fetch('/api/deliveries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carId })
        });
        if (res.ok) {
          const { data } = await res.json();
          // refresh deliveries
          const dRes = await fetch('/api/deliveries');
          if (dRes.ok) {
            const dJson = await dRes.json();
            setDeliveries(dJson.data || []);
          }
        }
      }

    } catch (err) {
      console.error('An error occurred in handleStatusChange:', err);
    }
  };

  const handleClientSelect = async (client: Client | null) => {
    if (!client) {
      setSelectedClient(null);
      setSelectedCar(null);
      return;
    }

    // Fetch full client data with populated cars
    try {
      const res = await fetch(`/api/clients/${client._id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedClient(json.data || client);
      } else {
        // Fallback to the client from the list if fetch fails
        setSelectedClient(client);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
      // Fallback to the client from the list
      setSelectedClient(client);
    }
    setSelectedCar(null);
  };

  const handleClientDelete = async (clientId: string) => {
    try {
      const confirmed = window.confirm('Are you sure you want to delete this client? This action cannot be undone.');
      if (!confirmed) return;

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete client');
      }

      toast.success('Client deleted successfully');
      
      // Remove the client from the local state
      setClients((prevClients) => prevClients.filter((c) => c._id !== clientId));
      
      // Refresh data to ensure consistency
      await fetchData();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete client');
    }
  };

  const handleBack = () => {
    setSelectedCar(null);
    setSelectedClient(null);
    setSelectedDelivery(null);
    setEditingCar(null);
    setEditingClient(null);
  };

  const handleEditCar = (car: Car) => {
    setEditingCar(car);
    setSelectedCar(null);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setSelectedClient(null);
  };

  const handleReserveCar = async () => {
    if (!selectedCar?._id) return;
    await handleStatusChange(selectedCar._id, 'reserved');
  };

  const handleSaveCar = async (carData: FormData) => {
    const method = editingCar?._id ? 'PUT' : 'POST';
    const url = editingCar?._id ? `/api/cars/${editingCar._id}` : '/api/cars';

    try {
      const response = await fetch(url, {
        method,
        // Do NOT set Content-Type for FormData. Browser will set boundary.
        headers: { 
          'x-user-name': currentUserName || 'unknown',
          'x-user-phone': currentUserPhone || 'unknown',
        },
        body: carData,
      });
      if (!response.ok) throw new Error('Failed to save car');
      await fetchData();
      handleBack();
    } catch (error) {
      console.error('Error saving car:', error);
    }
  };

  const handleSaveClient = async (clientData: Omit<Client, '_id' | 'cars'>) => {
    const method = editingClient?._id ? 'PUT' : 'POST';
    const url = editingClient?._id ? `/api/clients/${editingClient._id}` : '/api/clients';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
      });
      if (!response.ok) throw new Error('Failed to save client');
      const json = await response.json();
      const savedClient = json?.data as any;
      // After saving, go back to Clients list immediately
      setActiveStatus('clients');
      handleBack();
      toast.success('Client saved');
      // Refresh in background (no await so UI isn't blocked)
      void fetchData();
      // If this client was created from a reserve intent, offer to jump back to reservation
      if (pendingReserveCarId && savedClient?._id) {
        const carId = pendingReserveCarId;
        setPendingReserveCarId(null);
        toast.success('Client created', {
          description: 'Link this client to reserve the car now.',
          action: {
            label: 'Reserve now',
            onClick: () => {
              // Re-open the reserve dialog and preselect this client
              setSelectedClientIdForReserve(String(savedClient._id));
              setReserveCarId(carId);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('Failed to save client');
    }
  };

  const filteredCars = React.useMemo(() => {
    if (activeStatus === 'all') return cars;
    if (activeStatus === 'clients' || activeStatus === 'notifications' || activeStatus === 'todo') return [];
    if (activeStatus === 'demo') {
      return cars.filter((car) => car.demo === true);
    }
    if (activeStatus === 'marketing') {
      return cars.filter((car) => (car.status === 'in-stock' || car.status === 'reserved') && Array.isArray(car.images) && car.images.length > 0);
    }
    return cars.filter((car) => car.status === activeStatus);
  }, [activeStatus, cars]);

  const renderBackButton = () => {
    const hasDetailOpen = !!(selectedCar || selectedClient || selectedDelivery || editingCar || editingClient);
    if (!hasDetailOpen) return null;
    const onBackClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
      // Avoid any default or bubbling behavior that could trigger unwanted navigation
      try {
        e?.preventDefault?.();
        e?.stopPropagation?.();
      } catch {}
      // Close any open detail/editor views first
      handleBack();
      return;
    };
    return (
      <button
        aria-label="Back"
        onClick={onBackClick}
        type="button"
        className="fixed left-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] md:left-6 md:bottom-6 z-[60] inline-flex items-center justify-center rounded-full bg-white text-blue-700 hover:text-blue-800 ring-1 ring-blue-200 shadow-lg w-14 h-14 active:scale-95 transition-transform pointer-events-auto"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
    );
  };

  // Show loading spinner until auth check completes
  if (!authChecked) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  
  if (!isAuthenticated) return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;

  if (editingCar) {
    return (
      <>
        <Suspense fallback={<ComponentLoader />}>
          <AddEditCar car={editingCar} onSave={handleSaveCar} onCancel={handleBack} />
        </Suspense>
        {((role === 'admin' || role === 'manager') || (userRole === 'admin' || userRole === 'manager')) && editingCar?._id && (
          <button
            type="button"
            onClick={async () => {
              try {
                const ok = typeof window === 'undefined' ? true : window.confirm('Delete this car and all associated images and deliveries? This cannot be undone.');
                if (!ok) return;
                const res = await fetch(`/api/cars/${editingCar._id}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) {
                  toast.success('Car deleted');
                  await fetchData();
                  handleBack();
                } else {
                  const t = await res.text();
                  console.error('Delete failed', t);
                  toast.error('Failed to delete car');
                }
              } catch (e) {
                console.error('Delete error', e);
                toast.error('Failed to delete car');
              }
            }}
            className="fixed bottom-24 right-4 z-[999] inline-flex items-center gap-2 rounded-full bg-red-600 text-white hover:bg-red-700 px-4 py-3 shadow-2xl"
            aria-label="Delete car"
            title="Delete car"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Delete</span>
          </button>
        )}
        {renderBackButton()}
        {renderReserveDialog()}
      </>
    );
  }
  
  if (editingClient) {
    return (
      <>
        <Suspense fallback={<ComponentLoader />}>
          <AddEditClient 
            client={editingClient} 
            onSave={handleSaveClient as (clientData: Partial<Client>) => void} 
            onCancel={() => { setActiveStatus('clients'); handleBack(); }} 
            onAddInteraction={handleAddInteraction} 
          />
        </Suspense>
        {renderBackButton()}
        {renderReserveDialog()}
      </>
    );
  }
  
  if (selectedCar) {
    return (
      <>
        <Suspense fallback={<ComponentLoader />}>
          <CarDetail 
            car={selectedCar} 
            onBack={handleBack} 
            onEdit={handleEditCar} 
            onStatusChange={(status) => handleStatusChange(selectedCar._id, status)} 
            onReserve={handleReserveCar} 
          />
        </Suspense>
        {renderBackButton()}
        {renderReserveDialog()}
      </>
    );
  }
  
  if (selectedDelivery) {
    return (
      <>
        <Suspense fallback={<ComponentLoader />}>
          <DeliveryDetail 
            delivery={selectedDelivery} 
            onBack={() => setSelectedDelivery(null)} 
            onSave={async (update) => {
              try {
                const res = await fetch(`/api/deliveries/${selectedDelivery._id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(update)
                });
                if (res.ok) {
                  // refresh list in background
                  const dRes = await fetch('/api/deliveries');
                  if (dRes.ok) {
                    const dJson = await dRes.json();
                    setDeliveries(dJson.data || []);
                  }
                } else {
                  const errText = await res.text();
                  console.error('Save failed:', errText);
                  throw new Error(errText);
                }
              } catch (e) {
                console.error('Save error', e);
                throw e;
              }
            }} 
          />
        </Suspense>
        {renderBackButton()}
        {renderReserveDialog()}
      </>
    );
  }
  
  if (selectedClient) {
    return (
      <>
        <Suspense fallback={<ComponentLoader />}>
          <ClientDetail 
            client={selectedClient} 
            onBack={handleBack} 
            onEdit={handleEditClient} 
            onSelectCar={handleCarSelect} 
          />
        </Suspense>
        {renderBackButton()}
        {renderReserveDialog()}
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<ComponentLoader />}>
        <Dashboard
          cars={filteredCars}
          clients={clients}
          activeStatus={activeStatus}
          onStatusFilterChange={setActiveStatus}
          onCarSelect={handleCarSelect}
          onAddCar={handleAddCar}
          onAddClient={handleAddClient}
          onStatusChange={handleStatusChange as (carId: string, status: CarState) => void}
          onClientSelect={handleClientSelect}
          onClientDelete={handleClientDelete}
          onLogout={handleLogout}
          userRole={role}
          deliveries={deliveries}
          onDeliverySelect={(d) => { setSelectedDelivery(d); setSelectedCar(null); setSelectedClient(null); }}
          notifications={notifications}
          unreadNotificationsCount={unreadNotificationsCount}
          todoEnabled={todoEnabled}
          marketingEnabled={marketingEnabled}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNotificationDone={handleNotificationDone}
          onNotificationSelect={async (n) => {
            try {
              if (n?.data?.deliveryId) {
                const id = n.data.deliveryId;
                let found = deliveries.find(d => String(d._id) === String(id));
                if (!found) {
                  const res = await fetch(`/api/deliveries/${id}`);
                  if (res.ok) {
                    const j = await res.json();
                    found = j?.data as Delivery;
                  }
                }
                if (found) {
                  setSelectedDelivery(found);
                  setSelectedCar(null);
                  setSelectedClient(null);
                  return;
                }
              }
              if (n?.data?.carId) {
                const id = n.data.carId;
                let found = cars.find(c => String(c._id) === String(id));
                if (!found) {
                  const res = await fetch(`/api/cars/${id}`);
                  if (res.ok) {
                    const j = await res.json();
                    found = j?.data as Car;
                  }
                }
                if (found) {
                  setSelectedCar(found);
                  setSelectedClient(null);
                  setSelectedDelivery(null);
                  return;
                }
              }
              // Fallback: open client if present (e.g., client_match notification)
              if (n?.data?.clientId) {
                const id = n.data.clientId;
                let foundClient = clients.find(c => String(c._id) === String(id));
                if (!foundClient) {
                  const res = await fetch(`/api/clients`);
                  if (res.ok) {
                    const j = await res.json();
                    const list = Array.isArray(j?.data) ? j.data as Client[] : [];
                    setClients(list);
                    foundClient = list.find(c => String(c._id) === String(id));
                  }
                }
                if (foundClient) {
                  setSelectedClient(foundClient);
                  setSelectedCar(null);
                  setSelectedDelivery(null);
                  return;
                }
              }
            } catch {}
          }}
        />
      </Suspense>
      {renderBackButton()}
      {renderReserveDialog()}
    </>
  );
}
