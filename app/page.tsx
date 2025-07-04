"use client";

import { useState, useEffect } from "react";
import { Car, Client, AppState, CarStatus } from "./types";
import { LoginForm } from "./components/login-form";
import { Dashboard } from "./components/dashboard";
import { CarDetail } from "./components/car-detail";
import { AddEditCar } from "./components/add-edit-car";
import { AddEditClient } from "./components/add-edit-client";
import { ReserveModal } from "./components/reserve-modal";

// Type aliases for local use
type TabId = CarStatus | "clients";

export default function Page() {
  const [appState, setAppState] = useState<AppState>({
    isAuthenticated: false,
    currentScreen: "dashboard",
    cars: [],
    clients: [],
    selectedCar: null,
    editingCar: null,
    editingClient: null,
    showReserveModal: false,
    activeTabId: "all" as CarStatus,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch Cars
        const carsRes = await fetch('/api/cars');
        if (!carsRes.ok) throw new Error('Failed to fetch cars');
        const { data: cars } = await carsRes.json();

        // Fetch Clients
        const clientsRes = await fetch('/api/clients');
        if (!clientsRes.ok) throw new Error('Failed to fetch clients');
        const { data: clients } = await clientsRes.json();

        setAppState(prev => ({ ...prev, cars, clients }));
      } catch (error) {
        console.error("Error fetching initial data:", error);
        // Optionally, set an error state to show a message to the user
      }
    };

    if (appState.isAuthenticated) {
      fetchInitialData();
    }
  }, [appState.isAuthenticated]);

  // Navigation helpers
  function navigateTo(screen: AppState['currentScreen'], params: any = {}) {
    setAppState(prev => ({ ...prev, currentScreen: screen, ...params }));
  }

  // Car logic
  async function addCar(carData: FormData) {
    try {
      const response = await fetch('/api/cars', {
        method: 'POST',
        body: carData,
      });

      if (!response.ok) {
        throw new Error('Failed to create car');
      }

      const { data: newCar } = await response.json();

      setAppState((prev) => ({
        ...prev,
        cars: [...prev.cars, newCar],
        currentScreen: 'dashboard',
      }));
    } catch (error) {
      console.error('Error adding car:', error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }
  async function updateCar(carId: string, carData: FormData) {
    try {
      const response = await fetch(`/api/cars/${carId}`, {
        method: 'PUT',
        body: carData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Failed to update car' }));
        throw new Error(errorBody.message);
      }

      const responseBody = await response.json();
      if (!responseBody.success) {
        throw new Error(responseBody.message || 'API returned success:false');
      }

      const updatedCar = responseBody.data;

      setAppState((prev) => ({
        ...prev,
        cars: prev.cars.map((c) => (c.id === carId ? updatedCar : c)),
        currentScreen: 'dashboard',
        editingCar: null,
      }));
    } catch (error) {
      console.error('Error updating car:', error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }
  function updateCarStatus(carId: string, status: CarStatus, reservedBy?: string, phone?: string) {
    setAppState((prev) => {
      const updatedCars = prev.cars.map((car) => {
        if (car.id === carId) {
          const newStatus = { ...car, status };
          if (status === "reserved" && reservedBy && phone) {
            newStatus.reservedBy = `${reservedBy} (${phone})`;
          } else if (status !== "reserved") {
            newStatus.reservedBy = undefined;
          }
          return newStatus;
        }
        return car;
      });

      const newState = {
        ...prev,
        cars: updatedCars,
        showReserveModal: false,
      };

      if (prev.selectedCar?.id === carId) {
        newState.selectedCar = updatedCars.find(c => c.id === carId) || null;
      }

      return newState;
    });
  }
  function showReserveModal() {
    setAppState(prev => ({ ...prev, showReserveModal: true }));
  }
  function hideReserveModal() {
    setAppState(prev => ({ ...prev, showReserveModal: false }));
  }
  // Client logic
  function deleteClient(clientId: string) {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c._id !== clientId),
    }));
  }
  async function addClient(clientData: Partial<Client>) {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      const { data: newClient } = await response.json();

      setAppState((prev) => ({
        ...prev,
        clients: [...prev.clients, newClient],
        currentScreen: 'dashboard',
        activeTabId: 'clients'
      }));
    } catch (error) {
      console.error('Error adding client:', error);
    }
  }
  async function addInteraction(clientId: string, note: string) {
    try {
      const response = await fetch(`/api/clients/${clientId}/interactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note }),
        });

      if (!response.ok) {
        throw new Error('Failed to add interaction');
      }

      const { data: updatedClient } = await response.json();

      setAppState((prev) => ({
        ...prev,
        clients: prev.clients.map((c) => (c._id === clientId ? updatedClient : c)),
        editingClient: updatedClient,
      }));
    } catch (error) {
      console.error('Error adding interaction:', error);
    }
  }

  const updateClient = (clientId: string, clientData: Partial<Client>) => {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.map((client) =>
        client._id === clientId
          ? { ...client, ...clientData }
          : client
      ),
      currentScreen: "dashboard",
      activeTabId: "clients" as TabId,
    }))
  }

  const handleLoginSuccess = () => {
    setAppState(prev => ({ ...prev, isAuthenticated: true, currentScreen: 'dashboard' }));
  };

  if (!appState.isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto bg-background min-h-screen px-4">
      {appState.currentScreen === "dashboard" && (
        <Dashboard
          cars={appState.cars}
          clients={appState.clients}
          onCarSelect={(car) => navigateTo("car-detail", { selectedCar: car })}
          onAddCar={() => navigateTo("add-car")}
          onAddClient={() => navigateTo("add-client")}
          activeTabId={appState.activeTabId as TabId}
          onTabChange={(tabId: string) => setAppState(prev => ({ ...prev, activeTabId: tabId as CarStatus | "clients" }))}
          onClientSelect={(client) => navigateTo("edit-client", { editingClient: client })}
          onClientDelete={(clientId) => deleteClient(clientId)}
          onStatusChange={(carId, status) => {
            if (status === "reserved") {
              const selected = appState.cars.find((c) => c.id === carId)
              if (selected) {
                setAppState((prev) => ({ ...prev, selectedCar: selected, showReserveModal: true }))
              }
            } else {
              updateCarStatus(carId, status)
            }
          }}
        />
      )}
      {appState.currentScreen === "car-detail" && appState.selectedCar && (
        <CarDetail
          car={appState.selectedCar}
          onBack={() => navigateTo("dashboard")}
          onEdit={(car) => navigateTo("edit-car", { editingCar: car })}
          onReserve={showReserveModal}
          onStatusChange={(status) => updateCarStatus(appState.selectedCar!.id, status)}
        />
      )}
      {appState.currentScreen === "add-car" && <AddEditCar onSave={addCar} onCancel={() => navigateTo("dashboard")} />}
      {appState.currentScreen === "edit-car" && appState.editingCar && (
        <AddEditCar
          car={appState.editingCar}
          onSave={(carData) => updateCar(appState.editingCar!.id, carData)}
          onCancel={() => navigateTo("dashboard")}
        />
      )}
      {appState.currentScreen === "add-client" && (
        <AddEditClient onSave={addClient} onCancel={() => navigateTo("dashboard", { activeTabId: "clients" })} />
      )}
      {appState.currentScreen === "edit-client" && appState.editingClient && (
        <AddEditClient
          client={appState.editingClient}
          onSave={(clientData) => updateClient(appState.editingClient!._id, clientData)}
          onCancel={() => navigateTo("dashboard", { activeTabId: "clients" })}
          onAddInteraction={addInteraction}
          onDelete={(clientId) => {
            deleteClient(clientId)
            navigateTo("dashboard", { activeTabId: "clients" })
          }}
        />
      )}
      {appState.showReserveModal && appState.selectedCar && (
        <ReserveModal
          car={appState.selectedCar}
          clients={appState.clients}
          onConfirm={(name, phone) => updateCarStatus(appState.selectedCar!.id, "reserved", name, phone)}
          onClose={hideReserveModal}
        />
      )}
    </div>
  )
}
