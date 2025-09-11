"use client";

import React from 'react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from './login-form';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab, Delivery } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

  const [activeStatus, setActiveStatus] = useState<DashboardTab>('all');

  // Ensure that when a client is opened, we have the fully populated record
  // including associated cars merged from both Client.cars and Delivery links.
  React.useEffect(() => {
    const id = selectedClient?._id;
    if (!id) return;
    // If cars are already populated objects (not just string IDs), skip fetch
    const cars = (selectedClient as any)?.cars;
    const hasPopulatedCars = Array.isArray(cars) && cars.some((c: any) => c && typeof c === 'object' && !!c._id);
    if (hasPopulatedCars) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${id}`);
        if (!res.ok) return;
        const json = await res.json();
        const detailed = json?.data as Client | undefined;
        if (!cancelled && detailed?._id) {
          setSelectedClient(detailed);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selectedClient?._id]);

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
      console.error("Fetch error:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Refresh data when switching to delivery tab
  useEffect(() => {
    if (isAuthenticated && activeStatus === 'delivery') {
      fetchData();
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
          const data = j?.data as { phone?: string; firstName?: string; lastName?: string } | undefined;
          const phone = data?.phone as string | undefined;
          const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
          if (mounted) {
            setIsAuthenticated(true);
            if (phone) setCurrentUserPhone(phone);
            if (name) setCurrentUserName(name);
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
          const data = j?.data as { phone?: string; firstName?: string; lastName?: string } | undefined;
          const phone = data?.phone as string | undefined;
          const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
          if (phone) setCurrentUserPhone(phone);
          if (name) setCurrentUserName(name);
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

  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    setSelectedCar(null);
  };

  const handleClientDelete = async (clientId: string) => {
    // API call to delete client
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
      await fetchData();
      handleBack();
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
    }
  };

  const filteredCars = activeStatus === 'all'
    ? cars
    : activeStatus === 'clients'
      ? []
      : activeStatus === 'demo'
        ? cars.filter(car => car.demo === true)
        : cars.filter(car => car.status === activeStatus);

  const renderBackButton = () => {
    const hasDetailOpen = !!(selectedCar || selectedClient || selectedDelivery || editingCar || editingClient);
    const onBackClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
      // Avoid any default or bubbling behavior that could trigger unwanted navigation
      try {
        e?.preventDefault?.();
        e?.stopPropagation?.();
      } catch {}
      if (hasDetailOpen) {
        // Close any open detail/editor views first
        handleBack();
        return;
      }

      // Determine whether we're currently in a Stock view or a non-Stock (Clients/Delivery) view
      const isStockStatus = ['all', 'in-stock', 'coming', 'reserved', 'sold', 'demo'].includes(activeStatus as string);

      if (isStockStatus) {
        // From Stock, go to a non-Stock tab to reveal the other menu (Clients, Deliveries, etc.)
        setActiveStatus('delivery');
      } else {
        // From non-Stock tabs, go back to Stock (All)
        setActiveStatus('all');
      }
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
            onCancel={handleBack} 
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
                  const { data } = await res.json();
                  setSelectedDelivery(data);
                  // refresh list
                  const dRes = await fetch('/api/deliveries');
                  if (dRes.ok) {
                    const dJson = await dRes.json();
                    setDeliveries(dJson.data || []);
                  }
                } else {
                  const errText = await res.text();
                  console.error('Save failed:', errText);
                }
              } catch (e) {
                console.error('Save error', e);
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
          userRole={userRole}
          deliveries={deliveries}
          onDeliverySelect={(d) => { setSelectedDelivery(d); setSelectedCar(null); setSelectedClient(null); }}
        />
      </Suspense>
      {renderBackButton()}
      {renderReserveDialog()}
    </>
  );
}
