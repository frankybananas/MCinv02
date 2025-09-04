"use client";

import { useState, useEffect, lazy, Suspense } from 'react';
import { LoginForm } from './login-form';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab, Delivery } from '../types';

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
      const response = await fetch(`/api/cars/${carId}`,
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-name': currentUserName || 'unknown',
            'x-user-phone': currentUserPhone || 'unknown',
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

      // Auto-create or upsert a delivery when reserved/sold
      if (status === 'reserved' || status === 'sold') {
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
      await fetchData();
      handleBack();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const filteredCars = activeStatus === 'all'
    ? cars
    : activeStatus === 'clients'
      ? []
      : cars.filter(car => car.status === activeStatus);

  // Show loading spinner until auth check completes
  if (!authChecked) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  
  if (!isAuthenticated) return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;

  if (editingCar) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <AddEditCar car={editingCar} onSave={handleSaveCar} onCancel={handleBack} />
      </Suspense>
    );
  }
  
  if (editingClient) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <AddEditClient 
          client={editingClient} 
          onSave={handleSaveClient as (clientData: Partial<Client>) => void} 
          onCancel={handleBack} 
          onAddInteraction={handleAddInteraction} 
        />
      </Suspense>
    );
  }
  
  if (selectedCar) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <CarDetail 
          car={selectedCar} 
          onBack={handleBack} 
          onEdit={handleEditCar} 
          onStatusChange={(status) => handleStatusChange(selectedCar._id, status)} 
          onReserve={handleReserveCar} 
        />
      </Suspense>
    );
  }
  
  if (selectedDelivery) {
    return (
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
    );
  }
  
  if (selectedClient) {
    return (
      <Suspense fallback={<ComponentLoader />}>
        <ClientDetail 
          client={selectedClient} 
          onBack={handleBack} 
          onEdit={handleEditClient} 
          onSelectCar={handleCarSelect} 
        />
      </Suspense>
    );
  }

  return (
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
  );
}
