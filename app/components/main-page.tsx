"use client";

import { useState, useEffect } from 'react';
import { Dashboard } from './dashboard';
import { LoginForm } from './login-form';
import { CarDetail } from './car-detail';
import { ClientDetail } from './client-detail';
import { AddEditCar } from './add-edit-car';
import { AddEditClient } from './add-edit-client';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab } from '../types';

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
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [activeStatus, setActiveStatus] = useState<DashboardTab>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsRes, carsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/cars'),
      ]);

      if (!clientsRes.ok || !carsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const clientsData = await clientsRes.json();
      const carsData = await carsRes.json();

      setClients(clientsData.data || []);
      setCars(carsData.data || []);
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

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleCarSelect = (car: Car) => {
    setSelectedCar(car);
    setSelectedClient(null);
  };

  const handleAddCar = () => setEditingCar({} as Car);
  const handleAddClient = () => setEditingClient({} as Client);

  const handleStatusChange = async (carId: string, status: CarState) => {
    try {
      const response = await fetch(`/api/cars/${carId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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

    } catch (err) {
      console.error('An error occurred in handleStatusChange:', err);
    }
  };

  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    setSelectedCar(null);
  };

  const handleClientDelete = async (clientId: string) => {
    console.log('Delete client:', clientId);
    // API call to delete client
  };

  const handleBack = () => {
    setSelectedCar(null);
    setSelectedClient(null);
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

  const handleReserveCar = () => {
    console.log('Reserving car:', selectedCar);
    // Future: Open reserve modal
  };

  const handleSaveCar = async (carData: FormData) => {
    const method = editingCar?._id ? 'PUT' : 'POST';
    const url = editingCar?._id ? `/api/cars/${editingCar._id}` : '/api/cars';

    try {
      const response = await fetch(url, { method, body: carData });
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
    if (editingClient) return <AddEditClient client={editingClient} onSave={handleSaveClient as (clientData: Partial<Client>) => void} onCancel={handleBack} />;
  
      if (selectedCar) {
    return <CarDetail car={selectedCar} onBack={handleBack} onEdit={handleEditCar} onStatusChange={(status) => handleStatusChange(selectedCar._id, status)} onReserve={handleReserveCar} />;
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
    />
  );
}
