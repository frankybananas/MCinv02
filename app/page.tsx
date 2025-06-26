"use client";

import { useState } from "react";
import { Car, Client, AppState, CarStatus } from "./types";
import { LoginScreen } from "./components/login-screen";
import { OTPScreen } from "./components/otp-screen";
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
    currentScreen: "login", // "login" | "otp" | "dashboard" | "car-detail" | "add-car" | "edit-car" | "add-client" | "edit-client"
    phoneNumber: "",
    cars: [],
    clients: [],
    selectedCar: null,
    editingCar: null,
    editingClient: null,
    showReserveModal: false,
    activeTabId: "all" as CarStatus,
  });

  // Navigation helpers
  function navigateTo(screen: AppState['currentScreen'], params: any = {}) {
    setAppState(prev => ({ ...prev, currentScreen: screen, ...params }));
  }

  // Authentication logic
  function login(phone: string) {
    setAppState((prev) => ({ ...prev, phoneNumber: phone, currentScreen: "otp" }));
  }
  function verifyOTP(otp: string) {
    // Mock OTP check
    if (otp === "1234") {
      setAppState((prev) => ({ ...prev, currentScreen: "dashboard" }));
    }
  }

  // Car logic
  async function addCar(carData: Partial<Car>) {
    try {
      const response = await fetch('/api/cars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(carData),
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
      // Optionally, show an error message to the user
    }
  }
  function updateCar(carId: string, carData: Partial<Car>) {
    setAppState((prev) => ({
      ...prev,
      cars: prev.cars.map((car) => (car.id === carId ? { ...car, ...carData } : car)),
      currentScreen: "dashboard"
    }));
  }
  function updateCarStatus(carId: string, status: CarStatus, reservedBy?: string, phone?: string) {
    setAppState((prev) => {
      const statusChangeMessage = status === "reserved" ? `Reserved by ${reservedBy}` : status;
      const updatedCars = prev.cars.map((car) =>
        car.id === carId
          ? {
              ...car,
              status,
              reservedBy: status === "reserved" ? reservedBy : undefined,
              auditLog: [
                ...car.auditLog,
                {
                  action: "Status Changed",
                  user: "Current User",
                  timestamp: new Date().toISOString(),
                  details: statusChangeMessage,
                },
              ],
            }
          : car,
      );
      // If the currently selected car is the one updated, refresh it too
      const updatedSelected = prev.selectedCar && prev.selectedCar.id === carId
        ? updatedCars.find((c) => c.id === carId) || prev.selectedCar
        : prev.selectedCar;
      // Add client if provided
      // Add client if provided, creating a temporary client object.
      // Note: This client is only stored in local state and not yet saved to the database.
      const updatedClients = [...prev.clients];
      if (phone && reservedBy && !prev.clients.some((c) => c.phone === phone)) {
        const nameParts = reservedBy.split(' ');
        const newClient: Client = {
          id: Date.now().toString(),
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          email: `${Date.now()}@placeholder.com`, // Placeholder, as email is required
          phone,
        };
        updatedClients.push(newClient);
      }
      return {
        ...prev,
        cars: updatedCars,
        selectedCar: updatedSelected,
        showReserveModal: false,
        clients: updatedClients,
        activeTabId: "all" as CarStatus,
      };
    })
  }
  const showReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: true }))
  }
  const hideReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: false }))
  }
  // Client logic
  const deleteClient = (clientId: string) => {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.filter((client) => client.id !== clientId)
    }))
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
        activeTabId: 'clients' as TabId,
      }));
    } catch (error) {
      console.error('Error adding client:', error);
      // Optionally, show an error message to the user
    }
  }
  const updateClient = (clientId: string, clientData: Partial<Client>) => {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.map((client) =>
        client.id === clientId
          ? { ...client, ...clientData }
          : client
      ),
      currentScreen: "dashboard",
      activeTabId: "clients" as TabId,
    }))
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto bg-background min-h-screen px-4">
      {appState.currentScreen === "login" && <LoginScreen onLogin={login} />}
      {appState.currentScreen === "otp" && (
        <OTPScreen phoneNumber={appState.phoneNumber} onVerify={verifyOTP} onBack={() => navigateTo("login")} />
      )}
      {appState.currentScreen === "dashboard" && (
        <Dashboard
          cars={appState.cars}
          clients={appState.clients}
          onCarSelect={(car) => navigateTo("car-detail", { car })}
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
          onSave={(clientData) => updateClient(appState.editingClient!.id, clientData)}
          onCancel={() => navigateTo("dashboard", { activeTabId: "clients" })}
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
