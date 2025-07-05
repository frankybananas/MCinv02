"use client";

import { useState, useEffect } from 'react';
import { Dashboard } from './dashboard';
import { LoginForm } from './login-form';
import { CarDetail } from './car-detail';
import { AddEditCar } from './add-edit-car';
import type { Car, Client, Interaction, CarStatus, CarState, DashboardTab } from '../types';

interface MainPageProps {
  initialIsAuthenticated: boolean;
}

export default function MainPage({ initialIsAuthenticated }: MainPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.reload(); // Reload to reflect logged-out state
      } else {
        console.error('Logout failed');
      }
    } catch (err) {
      console.error('An error occurred during logout:', err);
    }
  };
      const [activeStatus, setActiveStatus] = useState<DashboardTab>('all');

  useEffect(() => {
    if (isAuthenticated) {
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

      fetchData();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleCarSelect = (car: Car) => {
    setSelectedCar(car);
  };
  const handleAddCar = () => console.log('Add car clicked');
  const handleAddClient = () => console.log('Add client clicked');

          const handleStatusChange = async (carId: string, status: CarState) => {
      console.log(`[1] handleStatusChange triggered for carId: ${carId} to status: ${status}`);

      try {
        console.log('[2] Calling API: PUT /api/cars/' + carId);
        const response = await fetch(`/api/cars/${carId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        console.log('[3] API response received.');

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[4a] API response not OK.', { status: response.status, text: errorText });
          throw new Error(`API Error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[4b] API response OK. Data received:', result.data);

        const updatedCar = result.data as Car;

        setCars(currentCars => {
          console.log('[5] Updating cars state array.');
          return currentCars.map(car => (car._id === carId ? updatedCar : car));
        });

        if (selectedCar?._id === carId) {
          console.log('[6] Updating selectedCar state.');
          setSelectedCar(updatedCar);
        }

      } catch (err) {
        console.error('[ERROR] An error occurred in handleStatusChange:', err);
      } finally {
        console.log('[7] handleStatusChange finished.');
      }
    };

  const handleClientSelect = (client: Client | null) => console.log('Client selected:', client);
  const handleClientDelete = async (clientId: string) => {
    console.log('Delete client:', clientId);
    // Here you would make an API call to delete the client
  };

        const filteredCars = activeStatus === 'all' 
    ? cars 
    : activeStatus === 'clients'
    ? [] // Don't show any cars when the clients tab is active
    : cars.filter(car => car.status === activeStatus);

  const handleBackFromDetail = () => {
    setSelectedCar(null);
  };

  const handleEditCar = (car: Car) => {
    setEditingCar(car);
    setSelectedCar(null); // Close the detail view
  };

  const handleReserveCar = () => {
    console.log('Reserving car:', selectedCar);
    // Future: Open reserve modal
  };

  const handleSaveCar = async (carData: FormData) => {
    const carId = editingCar?._id;
    if (!carId) return;

    try {
      const response = await fetch(`/api/cars/${carId}`, {
        method: 'PUT',
        body: carData,
      });

      if (!response.ok) {
        throw new Error('Failed to save car');
      }

      const updatedCar = await response.json();
      setCars(cars.map(c => c._id === carId ? updatedCar.data : c));
      setEditingCar(null);
    } catch (error) {
      console.error('Error saving car:', error);
    }
  };

  if (editingCar) {
    return <AddEditCar car={editingCar} onSave={handleSaveCar} onCancel={() => setEditingCar(null)} />;
  }

  if (selectedCar) {
    return (
      <CarDetail
        car={selectedCar}
        onBack={handleBackFromDetail}
        onEdit={handleEditCar}
        onReserve={handleReserveCar}
        onStatusChange={(status) => handleStatusChange(selectedCar._id, status)}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;
  }

  return (
    <Dashboard
      cars={filteredCars}
      clients={clients}
      activeStatus={activeStatus} // Pass active status
      onStatusFilterChange={setActiveStatus} // Pass status change handler
      onCarSelect={handleCarSelect}
      onAddCar={handleAddCar}
      onAddClient={handleAddClient}
      onStatusChange={handleStatusChange as (carId: string, status: CarState) => void}
      onClientSelect={handleClientSelect}
      onClientDelete={handleClientDelete}
      onLogout={handleLogout} // Pass logout handler
    />
  );
}
