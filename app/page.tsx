"use client";

import { useState, useEffect } from "react";
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

    if (appState.currentScreen === 'dashboard') {
      fetchInitialData();
    }
  }, [appState.currentScreen]);

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
    async function updateCar(carId: string, carData: Partial<Car>) {
    // Create a deep copy to avoid mutating the original state directly
    const dataToSend = JSON.parse(JSON.stringify(carData));

    // Filter out temporary blob URLs before sending to the backend.
    if (dataToSend.images && Array.isArray(dataToSend.images)) {
      dataToSend.images = dataToSend.images.filter(
        (image: any) => typeof image === 'object' && image !== null
      );
    }

    try {
      const response = await fetch(`/api/cars/${carId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
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

      setAppState((prev) => {
        const newCars = prev.cars.map((car) => (car.id === carId ? updatedCar : car));
        return {
          ...prev,
          cars: newCars,
          currentScreen: 'dashboard',
          selectedCar: null,
          editingCar: null,
        };
      });
    } catch (error) {
      console.error('Error in updateCar:', error);
      // Optionally, show an error message to the user
    }
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
  async function addInteraction(clientId: string, note: string) {
    try {
      const response = await fetch(`/api/clients/${clientId}/interactions`,
        {
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
        clients: prev.clients.map((c) => (c.id === clientId ? updatedClient : c)),
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
          onSave={(clientData) => updateClient(appState.editingClient!.id, clientData)}
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
