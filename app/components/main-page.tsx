"use client";

import { useState, useEffect } from 'react';
import { Dashboard } from './dashboard';
import { DeliveryDetail } from './delivery-detail';
import { LoginForm } from './login-form';
import { CarDetail } from './car-detail';
import { ClientDetail } from './client-detail';
import { AddEditCar } from './add-edit-car';
import { AddEditClient } from './add-edit-client';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab, Delivery } from '../types';

interface MainPageProps {
  initialIsAuthenticated: boolean;
  userRole: string | null;
}

export default function MainPage({ initialIsAuthenticated, userRole }: MainPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
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
      const [clientsRes, carsRes, deliveriesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/cars'),
        fetch('/api/deliveries'),
      ]);

      if (!clientsRes.ok || !carsRes.ok || !deliveriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const clientsData = await clientsRes.json();
      const carsData = await carsRes.json();
      const deliveriesData = await deliveriesRes.json();

      setClients(clientsData.data || []);
      setCars(carsData.data || []);
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

  // Fetch current user info for audit logging (phone)
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const j = await res.json();
        const data = j?.data as { phone?: string; firstName?: string; lastName?: string } | undefined;
        const phone = data?.phone as string | undefined;
        const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
        if (mounted) {
          if (phone) setCurrentUserPhone(phone);
          if (name) setCurrentUserName(name);
        }
      } catch {}
    };
    run();
    return () => { mounted = false; };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
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

  if (!isAuthenticated) return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;

  if (editingCar) return <AddEditCar car={editingCar} onSave={handleSaveCar} onCancel={handleBack} />;
    if (editingClient) return <AddEditClient client={editingClient} onSave={handleSaveClient as (clientData: Partial<Client>) => void} onCancel={handleBack} onAddInteraction={handleAddInteraction} />;
  
      if (selectedCar) {
    return <CarDetail car={selectedCar} onBack={handleBack} onEdit={handleEditCar} onStatusChange={(status) => handleStatusChange(selectedCar._id, status)} onReserve={handleReserveCar} />;
  }
  if (selectedDelivery) {
    return <DeliveryDetail delivery={selectedDelivery} onBack={() => setSelectedDelivery(null)} onSave={async (update) => {
      try {
        const res = await fetch(`/api/deliveries/${selectedDelivery._id}` , {
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
    }} />
  }
  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={handleBack} onEdit={handleEditClient} onSelectCar={handleCarSelect} />;
  }

  return (
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
  );
}
